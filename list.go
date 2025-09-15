package main

import (
	"net/http"
	"os"
)

// createHTTPServer creates the HTTP server for the list app
func createHTTPServer() *http.ServeMux {
	mux := http.NewServeMux()

	// Main list app page
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveReactApp(w, r, "index.tsx", "App")
	})

	// Legal pages
	mux.HandleFunc("/terms-of-service", func(w http.ResponseWriter, r *http.Request) {
		serveReactApp(w, r, "index.tsx", "App")
	})

	mux.HandleFunc("/privacy-policy", func(w http.ResponseWriter, r *http.Request) {
		serveReactApp(w, r, "index.tsx", "App")
	})

	mux.HandleFunc("/refund-policy", func(w http.ResponseWriter, r *http.Request) {
		serveReactApp(w, r, "index.tsx", "App")
	})

	// Component renderer endpoint for debugging
	mux.HandleFunc("/render/", handleRenderComponent)

	// ES Module endpoint for serving compiled JavaScript
	mux.HandleFunc("/module/", handleServeModule)

	// API endpoint for frontend configuration
	mux.HandleFunc("/api/config", handleAPIConfig)

	// Static file server for CSS and fonts
	fileServer := http.FileServer(http.Dir("public/"))
	mux.Handle("/static/", http.StripPrefix("/static/", fileServer))

	return mux
}

// serveReactApp serves a React application
func serveReactApp(w http.ResponseWriter, r *http.Request, componentPath, componentName string) {
	// Check if the component file exists
	if _, err := os.Stat(componentPath); os.IsNotExist(err) {
		// Serve a default page if component doesn't exist
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(generateDefaultHTML()))
		return
	}

	// Generate HTML page for the component
	htmlPage := generateComponentHTML(componentName, componentPath)
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlPage))
}

// generateDefaultHTML creates a default HTML page when no component is found
func generateDefaultHTML() string {
	return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>List App</title>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/daisyui@5">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="text-4xl font-bold mb-4">List App</h1>
        <p class="text-lg mb-4">Welcome to the minimalist list app!</p>
        <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
                <h2 class="card-title">Available Features</h2>
                <ul class="list-disc list-inside space-y-2">
                    <li>Text-based content management</li>
                    <li>Group collaboration</li>
                    <li>Real-time updates with Supabase</li>
                    <li>Component rendering at <code>/render/{path}</code></li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`
}

