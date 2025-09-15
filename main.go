package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/urfave/cli/v2"
)

// Global configuration for HTTP handlers
var currentConfig *Config

func main() {
	app := &cli.App{
		Name:  "list",
		Usage: "Minimalist List App with Supabase",
		Commands: []*cli.Command{
			{
				Name:  "serve",
				Usage: "Start the development server",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "port",
						Value: "3002",
						Usage: "Port to run server on",
					},
					&cli.StringFlag{
						Name:  "supabase-url",
						Usage: "Override Supabase URL",
					},
					&cli.StringFlag{
						Name:  "supabase-key",
						Usage: "Override Supabase anonymous key",
					},
				},
				Action: serveCommand,
			},
			{
				Name:   "build",
				Usage:  "Build the application for production",
				Action: buildCommand,
			},
			{
				Name:      "run",
				Usage:     "Run predefined commands",
				ArgsUsage: "<command>",
				Description: "Available commands:\n" +
					"   migrate - Run database migrations (npx supabase db push)\n" +
					"   types   - Generate TypeScript types from database schema",
				Action: runCommand,
			},
			{
				Name:   "deploy",
				Usage:  "Build and deploy the application to Cloudflare Pages",
				Action: deployCommand,
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}

// serveCommand starts the development server
func serveCommand(c *cli.Context) error {
	port := c.String("port")
	supabaseURL := c.String("supabase-url")
	supabaseKey := c.String("supabase-key")

	// Load configuration
	config, err := LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Override port if provided
	if port != "3002" {
		config.Port = port
	}

	// Override Supabase config if provided
	if supabaseURL != "" {
		config.SupabaseURL = supabaseURL
	}
	if supabaseKey != "" {
		config.SupabaseKey = supabaseKey
	}

	// Set global config for HTTP handlers
	currentConfig = config

	mux := createHTTPServer()

	fmt.Printf("🚀 List App Server starting on http://localhost:%s\n", config.Port)
	fmt.Printf("📁 Serving from: %s\n", getCurrentDir())
	fmt.Printf("🔧 Development mode with esbuild integration\n")
	fmt.Printf("🎯 Available endpoints:\n")
	fmt.Printf("   • GET  /              - Main List app\n")
	fmt.Printf("   • GET  /render/{path} - Component debugging\n")
	fmt.Printf("   • GET  /module/{path} - ES module serving\n")

	return http.ListenAndServe(":"+config.Port, mux)
}

// buildCommand builds the application for production
func buildCommand(c *cli.Context) error {
	fmt.Println("🏗️ Starting production build...")

	buildDir := "./build"

	// Create build directory if it doesn't exist
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return fmt.Errorf("failed to create build directory: %v", err)
	}

	// Build main app bundle
	result := buildWithEsbuild("./index.tsx", filepath.Join(buildDir, "app.js"), true)

	if len(result.Errors) > 0 {
		fmt.Println("❌ Production build failed:")
		for _, err := range result.Errors {
			fmt.Printf("   • %s\n", err.Text)
		}
		return fmt.Errorf("build failed with %d errors", len(result.Errors))
	}

	// Generate production HTML
	htmlContent := generateProductionHTML()
	htmlPath := filepath.Join(buildDir, "index.html")
	if err := os.WriteFile(htmlPath, []byte(htmlContent), 0644); err != nil {
		return fmt.Errorf("failed to write HTML file: %v", err)
	}

	// Copy font assets to build directory
	fmt.Println("📝 Copying font assets...")

	// Create fonts directory in build
	fontsDir := filepath.Join(buildDir, "fonts")
	if err := os.MkdirAll(fontsDir, 0755); err != nil {
		return fmt.Errorf("failed to create fonts directory: %v", err)
	}

	// Copy font files
	if err := copyDirectory("public/fonts", fontsDir); err != nil {
		return fmt.Errorf("failed to copy font files: %v", err)
	}

	// Copy compiled CSS file
	if err := copyFile("public/styles.css", filepath.Join(buildDir, "styles.css")); err != nil {
		return fmt.Errorf("failed to copy CSS file: %v", err)
	}

	fmt.Println("✅ Production build completed successfully!")
	fmt.Printf("📁 Output directory: %s\n", buildDir)
	fmt.Printf("📄 Files generated:\n")
	fmt.Printf("   • index.html\n")
	fmt.Printf("   • app.js\n")
	fmt.Printf("   • styles.css\n")
	fmt.Printf("   • fonts/ (directory with font files)\n")

	return nil
}

// deployCommand builds and deploys the application to Cloudflare Pages
func deployCommand(c *cli.Context) error {
	fmt.Println("🚀 Starting deployment process...")

	// First, run the build command
	fmt.Println("📦 Building application...")
	buildCmd := exec.Command("go", "run", ".", "build")
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	if err := buildCmd.Run(); err != nil {
		return fmt.Errorf("build failed: %v", err)
	}

	fmt.Println("✅ Build completed successfully!")

	// Then, deploy with wrangler
	fmt.Println("☁️  Deploying to Cloudflare Pages...")
	deployCmd := exec.Command("npx", "wrangler", "pages", "deploy", "./build")
	deployCmd.Stdout = os.Stdout
	deployCmd.Stderr = os.Stderr
	deployCmd.Stdin = os.Stdin

	if err := deployCmd.Run(); err != nil {
		return fmt.Errorf("deployment failed: %v", err)
	}

	fmt.Println("🎉 Deployment completed successfully!")
	return nil
}

// runCommand executes predefined bash commands based on command name
func runCommand(c *cli.Context) error {
	if c.NArg() == 0 {
		return fmt.Errorf("command name is required\n\nAvailable commands:\n   migrate - Run database migrations\n   types   - Generate TypeScript types")
	}

	commandName := c.Args().Get(0)

	// Command mappings
	commands := map[string]string{
		"migrate": "npx supabase db push",
		"types":   `npx supabase gen types typescript --project-id "zazsrepfnamdmibcyenx" --schema public > types/database.types.ts`,
	}

	bashCommand, exists := commands[commandName]
	if !exists {
		availableCommands := make([]string, 0, len(commands))
		for cmd := range commands {
			availableCommands = append(availableCommands, cmd)
		}
		return fmt.Errorf("unknown command '%s'\n\nAvailable commands: %s", commandName, strings.Join(availableCommands, ", "))
	}

	fmt.Printf("🔧 Running: %s\n", bashCommand)

	// Execute the bash command
	cmd := exec.Command("bash", "-c", bashCommand)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("command failed: %v", err)
	}

	fmt.Printf("✅ Command '%s' completed successfully\n", commandName)
	return nil
}

// getCurrentDir returns the current working directory for logging
func getCurrentDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	return dir
}

// handleRenderComponent builds and renders a React component in a simple HTML page
func handleRenderComponent(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	componentPath := strings.TrimPrefix(r.URL.Path, "/render/")
	if componentPath == "" {
		http.Error(w, "Component path is required", http.StatusBadRequest)
		return
	}

	componentName := r.URL.Query().Get("component")
	if componentName == "" {
		componentName = "App"
	}

	cleanPath := filepath.Clean(componentPath)
	if strings.Contains(cleanPath, "..") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	srcPath := filepath.Join(".", cleanPath)

	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		http.Error(w, "Source file not found", http.StatusNotFound)
		return
	}

	sourceCode, err := os.ReadFile(srcPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read source file: %v", err), http.StatusInternalServerError)
		return
	}

	// Build with esbuild for rendering
	result := buildComponentForRendering(string(sourceCode), filepath.Dir(srcPath), filepath.Base(srcPath))

	if len(result.Errors) > 0 {
		errorMessages := make([]string, len(result.Errors))
		for i, err := range result.Errors {
			errorMessages[i] = fmt.Sprintf("%s:%d:%d: %s", err.Location.File, err.Location.Line, err.Location.Column, err.Text)
		}

		errorHTML := generateErrorHTML(componentPath, errorMessages)
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(errorHTML))
		return
	}

	if len(result.OutputFiles) == 0 {
		http.Error(w, "No output generated from build", http.StatusInternalServerError)
		return
	}

	// Generate HTML page for component rendering
	htmlPage := generateComponentHTML(componentName, componentPath)
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlPage))
}

// handleServeModule builds and serves a React component as an ES module
func handleServeModule(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	componentPath := strings.TrimPrefix(r.URL.Path, "/module/")
	if componentPath == "" {
		http.Error(w, "Component path is required", http.StatusBadRequest)
		return
	}

	cleanPath := filepath.Clean(componentPath)
	if strings.Contains(cleanPath, "..") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	srcPath := filepath.Join(".", cleanPath)

	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		http.Error(w, "Source file not found", http.StatusNotFound)
		return
	}

	sourceCode, err := os.ReadFile(srcPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read source file: %v", err), http.StatusInternalServerError)
		return
	}

	// Inject Supabase configuration if this is the SupabaseClient.ts file
	sourceCodeStr := string(sourceCode)
	if strings.Contains(componentPath, "SupabaseClient.ts") || strings.Contains(componentPath, "SupabaseClient.js") {
		sourceCodeStr = injectSupabaseConfig(sourceCodeStr)
	}

	// Build as ES module for browser consumption
	result := buildAsESModule(sourceCodeStr, filepath.Dir(srcPath), filepath.Base(srcPath))

	if len(result.Errors) > 0 {
		errorMessages := make([]string, len(result.Errors))
		for i, err := range result.Errors {
			errorMessages[i] = fmt.Sprintf("%s:%d:%d: %s", err.Location.File, err.Location.Line, err.Location.Column, err.Text)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"error": "Build failed", "details": %q}`, errorMessages)
		return
	}

	if len(result.OutputFiles) == 0 {
		http.Error(w, "No output generated from build", http.StatusInternalServerError)
		return
	}

	compiledJS := string(result.OutputFiles[0].Contents)

	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write([]byte(compiledJS))
}

// buildWithEsbuild performs esbuild compilation with platform-specific settings
func buildWithEsbuild(inputPath, outputPath string, writeToDisk bool) api.BuildResult {
	return api.Build(api.BuildOptions{
		EntryPoints: []string{inputPath},
		Loader: map[string]api.Loader{
			".js":  api.LoaderJS,
			".jsx": api.LoaderJSX,
			".ts":  api.LoaderTS,
			".tsx": api.LoaderTSX,
			".css": api.LoaderCSS,
		},
		Outfile:          outputPath,
		Format:           api.FormatESModule,
		Bundle:           true,
		Write:            writeToDisk,
		MinifyWhitespace: true,
		TreeShaking:      api.TreeShakingTrue,
		Target:           api.ES2020,
		JSX:              api.JSXAutomatic,
		JSXImportSource:  "react",
		LogLevel:         api.LogLevelInfo,
		Sourcemap:        api.SourceMapInline,
		External:         []string{},
		TsconfigRaw: `{
			"compilerOptions": {
				"jsx": "react-jsx",
				"allowSyntheticDefaultImports": true,
				"esModuleInterop": true,
				"moduleResolution": "node",
				"target": "ES2020",
				"lib": ["ES2020", "DOM", "DOM.Iterable"],
				"allowJs": true,
				"skipLibCheck": true,
				"strict": false,
				"sourcemap": "inline",
				"forceConsistentCasingInFileNames": true,
				"noEmit": true,
				"incremental": true,
				"resolveJsonModule": true,
				"isolatedModules": true
			}
		}`,
	})
}

// buildComponentForRendering builds a component for HTML page rendering
func buildComponentForRendering(sourceCode, resolveDir, sourcefile string) api.BuildResult {
	return api.Build(api.BuildOptions{
		Stdin: &api.StdinOptions{
			Contents:   sourceCode,
			ResolveDir: resolveDir,
			Sourcefile: sourcefile,
			Loader:     api.LoaderTSX,
		},
		Loader: map[string]api.Loader{
			".js":  api.LoaderJS,
			".jsx": api.LoaderJSX,
			".ts":  api.LoaderTS,
			".tsx": api.LoaderTSX,
			".css": api.LoaderCSS,
		},
		Format:          api.FormatESModule,
		Bundle:          true,
		Write:           false,
		TreeShaking:     api.TreeShakingTrue,
		Target:          api.ESNext,
		JSX:             api.JSXAutomatic,
		JSXImportSource: "react",
		LogLevel:        api.LogLevelSilent,
		External:        []string{},
		TsconfigRaw: `{
			"compilerOptions": {
				"jsx": "react-jsx",
				"allowSyntheticDefaultImports": true,
				"esModuleInterop": true,
				"moduleResolution": "node",
				"target": "ESNext",
				"lib": ["ESNext", "DOM", "DOM.Iterable"],
				"allowJs": true,
				"skipLibCheck": true,
				"strict": false,
				"forceConsistentCasingInFileNames": true,
				"noEmit": true,
				"incremental": true,
				"resolveJsonModule": true,
				"isolatedModules": true
			}
		}`,
	})
}

// buildAsESModule builds source code as an ES module for direct browser consumption
func buildAsESModule(sourceCode, resolveDir, sourcefile string) api.BuildResult {
	return api.Build(api.BuildOptions{
		Stdin: &api.StdinOptions{
			Contents:   sourceCode,
			ResolveDir: resolveDir,
			Sourcefile: sourcefile,
			Loader:     api.LoaderTSX,
		},
		Loader: map[string]api.Loader{
			".js":  api.LoaderJS,
			".jsx": api.LoaderJSX,
			".ts":  api.LoaderTS,
			".tsx": api.LoaderTSX,
			".css": api.LoaderCSS,
		},
		Format:          api.FormatESModule,
		Bundle:          true,
		Write:           false,
		TreeShaking:     api.TreeShakingTrue,
		Target:          api.ES2020,
		JSX:             api.JSXAutomatic,
		JSXImportSource: "react",
		Sourcemap:       api.SourceMapInline,
		LogLevel:        api.LogLevelSilent,
		External:        []string{"react", "react-dom", "react/jsx-runtime", "@supabase/supabase-js"},
		TsconfigRaw: `{
			"compilerOptions": {
				"jsx": "react-jsx",
				"allowSyntheticDefaultImports": true,
				"esModuleInterop": true,
				"moduleResolution": "node",
				"target": "ES2020",
				"lib": ["ES2020", "DOM", "DOM.Iterable"],
				"allowJs": true,
				"skipLibCheck": true,
				"strict": false,
				"sourcemap": "inline",
				"forceConsistentCasingInFileNames": true,
				"noEmit": true,
				"incremental": true,
				"resolveJsonModule": true,
				"isolatedModules": true
			}
		}`,
	})
}

// generateErrorHTML creates an HTML page for displaying build errors
func generateErrorHTML(componentPath string, errors []string) string {
	errorItems := ""
	for _, err := range errors {
		errorItems += fmt.Sprintf(`<div class="error-item">%s</div>`, err)
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Build Error - List App</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #fff5f5; }
        .error { background: #fed7d7; border: 1px solid #fc8181; padding: 15px; border-radius: 5px; }
        .error h1 { color: #c53030; margin-top: 0; }
        .error-list { margin: 10px 0; }
        .error-item { margin: 5px 0; padding: 5px; background: #ffffff; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="error">
        <h1>🚨 Build Error</h1>
        <p>Failed to build component from <code>%s</code></p>
        <div class="error-list">
            %s
        </div>
        <h4>🔧 Troubleshooting:</h4>
        <ul>
            <li>Check TypeScript syntax and imports</li>
            <li>Verify all dependencies are properly exported</li>
            <li>Ensure Supabase client is correctly configured</li>
            <li>Check for circular dependencies</li>
        </ul>
    </div>
</body>
</html>`, componentPath, errorItems)
}

// generateComponentHTML creates an HTML page for rendering individual components
func generateComponentHTML(componentName, componentPath string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google" content="notranslate">
    <meta name="translate" content="no">
    <title>%s - List App</title>
    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@18",
            "react-dom": "https://esm.sh/react-dom@18",
            "react-dom/client": "https://esm.sh/react-dom@18/client",
            "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
            "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
        }
    }
    </script>
    <!-- Preload key Satoshi font files for better performance -->
    <link rel="preload" href="/static/fonts/Satoshi-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/static/fonts/Satoshi-Medium.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/static/fonts/Satoshi-Bold.woff2" as="font" type="font/woff2" crossorigin>
    
    <link rel="stylesheet" type="text/css" href="/static/styles.css">
    <style>
        #root { width: 100%%; height: 100vh; }
        .error { 
            padding: 20px; 
            color: #dc2626; 
            background: #fef2f2; 
            border: 1px solid #fecaca; 
            margin: 20px; 
            border-radius: 8px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module">
        try {
            const componentModule = await import('/module/%s');
            const React = await import('react');
            const ReactDOM = await import('react-dom/client');
            
            let ComponentToRender;
            if (componentModule.%s) {
                ComponentToRender = componentModule.%s;
            } else if (componentModule.default) {
                ComponentToRender = componentModule.default;
            } else {
                throw new Error('No component found. Make sure to export a component named "%s" or a default export.');
            }
            
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(ComponentToRender));
            
        } catch (error) {
            console.error('Runtime Error:', error);
            document.getElementById('root').innerHTML = 
                '<div class="error">' +
                '<h3>Runtime Error:</h3>' +
                '<pre>' + error.message + '</pre>' +
                '<pre>' + (error.stack || '') + '</pre>' +
                '</div>';
        }
    </script>
</body>
</html>`, componentName, componentPath, componentName, componentName, componentName)
}

// generateProductionHTML creates the production HTML for the app
func generateProductionHTML() string {
	return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google" content="notranslate">
    <meta name="translate" content="no">
    <title>List App</title>
    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@18",
            "react-dom": "https://esm.sh/react-dom@18",
            "react-dom/client": "https://esm.sh/react-dom@18/client",
            "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
            "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
        }
    }
    </script>
    <!-- Preload key Satoshi font files for better performance -->
    <link rel="preload" href="/fonts/Satoshi-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Satoshi-Medium.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Satoshi-Bold.woff2" as="font" type="font/woff2" crossorigin>
    
    <link rel="stylesheet" type="text/css" href="/styles.css">
    <style>
        #root { width: 100%; height: 100vh; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/app.js"></script>
</body>
</html>`
}

// handleAPIConfig serves the current Supabase configuration as JSON
func handleAPIConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Use global config or fallback to loading config
	config := currentConfig
	if config == nil {
		var err error
		config, err = LoadConfig()
		if err != nil {
			http.Error(w, "Failed to load configuration", http.StatusInternalServerError)
			return
		}
	}

	// Create response with only frontend-needed config
	configResponse := map[string]string{
		"supabase_url": config.SupabaseURL,
		"supabase_key": config.SupabaseKey,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")

	if err := json.NewEncoder(w).Encode(configResponse); err != nil {
		http.Error(w, "Failed to encode configuration", http.StatusInternalServerError)
		return
	}
}

// injectSupabaseConfig replaces hardcoded Supabase values with current configuration
func injectSupabaseConfig(sourceCode string) string {
	// Get current config
	config := currentConfig
	if config == nil {
		var err error
		config, err = LoadConfig()
		if err != nil {
			// If we can't load config, return original source code
			return sourceCode
		}
	}

	// Replace hardcoded SUPABASE_URL
	sourceCode = strings.ReplaceAll(sourceCode,
		"const SUPABASE_URL = 'https://zazsrepfnamdmibcyenx.supabase.co';",
		fmt.Sprintf("const SUPABASE_URL = '%s';", config.SupabaseURL))

	// Replace hardcoded SUPABASE_ANON_KEY
	sourceCode = strings.ReplaceAll(sourceCode,
		"const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM';",
		fmt.Sprintf("const SUPABASE_ANON_KEY = '%s';", config.SupabaseKey))

	return sourceCode
}

// copyFile copies a single file from src to dst
func copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}

	err = os.WriteFile(dst, input, 0644)
	if err != nil {
		return err
	}

	return nil
}

// copyDirectory copies all files from src directory to dst directory
func copyDirectory(src, dst string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// Create subdirectory
			if err := os.MkdirAll(dstPath, 0755); err != nil {
				return err
			}
			// Recursively copy subdirectory
			if err := copyDirectory(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			// Copy file
			if err := copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}
