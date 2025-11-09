package main

import (
	"net"
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// ANSI color codes for log output
const (
	colorReset   = "\033[0m"
	colorBlue    = "\033[34m"
	colorGreen   = "\033[32m"
	colorYellow  = "\033[33m"
	colorRed     = "\033[31m"
	colorCyan    = "\033[36m"
	colorMagenta = "\033[35m"
)

// LocalStack manages the local development environment
type LocalStack struct {
	supabaseCmd         *exec.Cmd
	lambdaCmd           *exec.Cmd
	frontendCmd         *exec.Cmd
	ctx                 context.Context
	cancel              context.CancelFunc
	config              *Config
	supabaseStartedByUs bool // Track if we started Supabase or user did separately
	standaloneMode      bool // If true, use standalone Node.js server instead of Docker
}

// NewLocalStack creates a new local stack manager
func NewLocalStack(configPath string) (*LocalStack, error) {
	// Load configuration from config.local.json
	config, err := LoadConfigFromPath(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &LocalStack{
		ctx:    ctx,
		cancel: cancel,
		config: config,
	}, nil
}

// Start starts all services in the local stack
func (ls *LocalStack) Start(skipSupabase bool, standaloneMode bool) error {
	ls.standaloneMode = standaloneMode

	fmt.Println(colorCyan + "🚀 Starting local development stack..." + colorReset)
	fmt.Println()

	// Check if Docker is running (only if not in standalone mode)
	if !standaloneMode {
		if err := ls.checkDocker(); err != nil {
			return fmt.Errorf("Docker check failed: %w", err)
		}
		fmt.Println(colorGreen + "✓ Docker is running" + colorReset)
	}

	// Start Supabase (or skip if flag set)
	if skipSupabase {
		fmt.Println(colorYellow + "⏭️  Skipping Supabase (manage separately)" + colorReset)

		// Check if Supabase is already running
		checkCmd := exec.Command("npx", "supabase", "status")
		if err := checkCmd.Run(); err != nil {
			fmt.Println(colorYellow + "⚠️  Warning: Supabase not detected - Lambda may fail if it needs database" + colorReset)
		} else {
			fmt.Println(colorGreen + "✓ Supabase is already running" + colorReset)
		}

		ls.supabaseStartedByUs = false
	} else {
		if err := ls.startSupabase(); err != nil {
			return fmt.Errorf("failed to start Supabase: %w", err)
		}
		fmt.Println(colorGreen + "✓ Started Supabase (ports 54321-54324)" + colorReset)
		ls.supabaseStartedByUs = true
	}

	// Build and start Lambda
	if err := ls.startLambda(); err != nil {
		ls.stopSupabase() // Cleanup on error
		return fmt.Errorf("failed to start Lambda: %w", err)
	}
	if standaloneMode {
		fmt.Println(colorGreen + "✓ Started Lambda standalone server (port 9001)" + colorReset)
	} else {
		fmt.Println(colorGreen + "✓ Started Lambda Docker container (port 9000)" + colorReset)
	}

	// Start frontend dev server
	if err := ls.startFrontend(); err != nil {
		ls.stopLambda()   // Cleanup on error
		ls.stopSupabase() // Cleanup on error
		return fmt.Errorf("failed to start frontend: %w", err)
	}
	fmt.Println(colorGreen + "✓ Started frontend dev server (port " + ls.config.Port + ")" + colorReset)

	fmt.Println()
	fmt.Println(colorCyan + "📦 Services running:" + colorReset)
	fmt.Println("  - Supabase API:    http://localhost:54321")
	fmt.Println("  - Supabase Studio: http://localhost:54323")
	if standaloneMode {
		fmt.Println("  - Lambda (direct): http://localhost:9001")
	} else {
		fmt.Println("  - Lambda (direct): http://localhost:9000")
	}
	fmt.Println("  - Lambda (proxy):  http://localhost:" + ls.config.Port + "/lambda-proxy")
	fmt.Println("  - Frontend:        http://localhost:" + ls.config.Port)
	fmt.Println()
	fmt.Println(colorMagenta + "⚡ Lambda endpoint configured: " + ls.config.LambdaEndpoint + colorReset)
	if standaloneMode {
		fmt.Println(colorYellow + "⚡ Lambda mode: Standalone Node.js server" + colorReset)
	} else {
		fmt.Println(colorYellow + "⚡ Lambda mode: Docker container" + colorReset)
	}
	fmt.Println()
	fmt.Println(colorYellow + "📋 Streaming logs (Ctrl+C to stop all services):" + colorReset)
	fmt.Println()

	return nil
}

// StreamLogs aggregates and streams logs from all services
func (ls *LocalStack) StreamLogs() {
	// Note: Log streaming is handled by Docker and Supabase CLI directly
	// This function just waits for context cancellation
	<-ls.ctx.Done()
}


// Stop stops all services gracefully
func (ls *LocalStack) Stop() error {
	fmt.Println()
	fmt.Println(colorYellow + "🛑 Stopping local development stack..." + colorReset)

	ls.cancel() // Cancel context to stop log streaming

	var errors []error

	if err := ls.stopFrontend(); err != nil {
		errors = append(errors, fmt.Errorf("frontend: %w", err))
	} else {
		fmt.Println(colorGreen + "✓ Stopped frontend dev server" + colorReset)
	}

	if err := ls.stopLambda(); err != nil {
		errors = append(errors, fmt.Errorf("lambda: %w", err))
	} else {
		if ls.standaloneMode {
			fmt.Println(colorGreen + "✓ Stopped Lambda standalone server" + colorReset)
		} else {
			fmt.Println(colorGreen + "✓ Stopped Lambda container" + colorReset)
		}
	}

	// Only stop Supabase if we started it
	if ls.supabaseStartedByUs {
		if err := ls.stopSupabase(); err != nil {
			errors = append(errors, fmt.Errorf("supabase: %w", err))
		} else {
			fmt.Println(colorGreen + "✓ Stopped Supabase services" + colorReset)
		}
	} else {
		fmt.Println(colorYellow + "⏭️  Skipped stopping Supabase (started separately)" + colorReset)
	}

	if len(errors) > 0 {
		fmt.Println(colorRed + "⚠️  Some services failed to stop cleanly:" + colorReset)
		for _, err := range errors {
			fmt.Println(colorRed + "   - " + err.Error() + colorReset)
		}
		return fmt.Errorf("failed to stop all services")
	}

	fmt.Println(colorGreen + "✅ Local stack stopped successfully" + colorReset)
	return nil
}

// checkDocker verifies Docker is running
func (ls *LocalStack) checkDocker() error {
	cmd := exec.Command("docker", "info")
	return cmd.Run()
}

// startSupabase starts Supabase services
func (ls *LocalStack) startSupabase() error {
	// Check if Supabase is already running
	checkCmd := exec.Command("npx", "supabase", "status")
	if err := checkCmd.Run(); err == nil {
		// Already running
		return nil
	}

	cmd := exec.CommandContext(ls.ctx, "npx", "supabase", "start")
	cmd.Dir = "."

	// Set output to inherit from parent process
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("supabase start failed: %w", err)
	}

	// Note: Don't store cmd - it's already completed and the actual Supabase services
	// run in Docker containers managed by the Supabase CLI. Cleanup is done via 'supabase stop'.

	return nil
}

// stopSupabase stops Supabase services
func (ls *LocalStack) stopSupabase() error {
	cmd := exec.Command("npx", "supabase", "stop")
	cmd.Dir = "."
	return cmd.Run()
}

// startLambda builds and starts the Lambda (Docker or standalone)
func (ls *LocalStack) startLambda() error {
	lambdaDir := filepath.Join(".", "lambda", "function")

	if ls.standaloneMode {
		return ls.startStandaloneLambda(lambdaDir)
	}
	return ls.startDockerLambda(lambdaDir)
}

// startDockerLambda builds and starts the Lambda Docker container
func (ls *LocalStack) startDockerLambda(lambdaDir string) error {
	// Check if port 9000 is available
	if err := checkPortAvailable("9000"); err != nil {
		return err
	}

	// Always stop and remove existing container first
	fmt.Println(colorYellow + "🧹 Cleaning up existing Lambda container..." + colorReset)
	stopCmd := exec.Command("docker", "stop", "lambda-local")
	stopCmd.Run() // Ignore errors if container doesn't exist

	removeCmd := exec.Command("docker", "rm", "lambda-local")
	removeCmd.Run() // Ignore errors

	// Build Lambda Docker image (uses layer caching for fast rebuilds)
	fmt.Println(colorYellow + "🏗️  Building Lambda Docker image..." + colorReset)
	buildCmd := exec.Command("docker", "build", "-t", "lambda-test", ".")
	buildCmd.Dir = lambdaDir
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	startTime := time.Now()
	if err := buildCmd.Run(); err != nil {
		return fmt.Errorf("docker build failed: %w", err)
	}

	buildDuration := time.Since(startTime)
	fmt.Println(colorGreen + fmt.Sprintf("✓ Docker build completed in %.1fs", buildDuration.Seconds()) + colorReset)

	// Get configuration values
	config := ls.config

	// Convert localhost URLs to Docker-accessible URLs
	// Docker containers can't reach host services via localhost
	supabaseURL := strings.ReplaceAll(config.SupabaseURL, "localhost", "host.docker.internal")

	// Start Lambda container
	args := []string{
		"run",
		"--rm",
		"-d",
		"--name", "lambda-local",
		"-p", "9000:8080",
		"-e", "SUPABASE_URL=" + supabaseURL,
		"-e", "SUPABASE_SERVICE_ROLE_KEY=" + config.GetString("supabase_service_role_key"),
	}

	// Add optional API keys if present
	if key := config.GetString("anthropic_api_key"); key != "" && key != "your_anthropic_api_key_here" {
		args = append(args, "-e", "ANTHROPIC_API_KEY="+key)
	}
	if key := config.GetString("openai_api_key"); key != "" && key != "your_openai_api_key_here" {
		args = append(args, "-e", "OPENAI_API_KEY="+key)
	}
	if key := config.GetString("cloudflare_api_key"); key != "" && key != "your_cloudflare_api_key_here" {
		args = append(args, "-e", "CLOUDFLARE_API_KEY="+key)
	}
	if key := config.GetString("cloudflare_account_id"); key != "" && key != "your_cloudflare_account_id_here" {
		args = append(args, "-e", "CLOUDFLARE_ACCOUNT_ID="+key)
	}
	if key := config.GetString("tmdb_api_key"); key != "" && key != "your_tmdb_api_key_here" {
		args = append(args, "-e", "TMDB_API_KEY="+key)
	}
	if key := config.GetString("deepgram_api_key"); key != "" && key != "your_deepgram_api_key_here" {
		args = append(args, "-e", "DEEPGRAM_API_KEY="+key)
	}

	args = append(args, "--add-host", "host.docker.internal:host-gateway")
	args = append(args, "lambda-test")

	cmd := exec.Command("docker", args...)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("docker run failed: %w", err)
	}

	// Wait a moment for container to start
	time.Sleep(2 * time.Second)

	// Set up log streaming
	logsCmd := exec.CommandContext(ls.ctx, "docker", "logs", "-f", "lambda-local")
	logsCmd.Stdout = os.Stdout
	logsCmd.Stderr = os.Stderr

	// Set process group so child processes are killed when parent exits
	logsCmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	logsCmd.Start()

	ls.lambdaCmd = logsCmd

	return nil
}

// checkPortAvailable returns an error if the port is already in use
func checkPortAvailable(port string) error {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%s", port), 100*time.Millisecond)
	if err == nil {
		// Port is in use (connection succeeded)
		conn.Close()
		return fmt.Errorf("port %s is already in use. Kill the process with: lsof -ti:%s | xargs kill -9", port, port)
	}
	// Port is available (connection failed)
	return nil
}

// startStandaloneLambda builds and starts the standalone Node.js Lambda server
func (ls *LocalStack) startStandaloneLambda(lambdaDir string) error {
	// Check if port 9001 is available
	if err := checkPortAvailable("9001"); err != nil {
		return err
	}

	// Note: No build step needed - tsx watch mode compiles on the fly
	// The build script is only used for Docker production builds

	// Get configuration values
	config := ls.config

	// Prepare environment variables
	env := append(os.Environ(),
		"SUPABASE_URL="+config.SupabaseURL, // No host.docker.internal conversion needed for standalone
		"SUPABASE_SERVICE_ROLE_KEY="+config.GetString("supabase_service_role_key"),
	)

	// Add optional API keys if present
	if key := config.GetString("anthropic_api_key"); key != "" && key != "your_anthropic_api_key_here" {
		env = append(env, "ANTHROPIC_API_KEY="+key)
	}
	if key := config.GetString("openai_api_key"); key != "" && key != "your_openai_api_key_here" {
		env = append(env, "OPENAI_API_KEY="+key)
	}
	if key := config.GetString("cloudflare_api_key"); key != "" && key != "your_cloudflare_api_key_here" {
		env = append(env, "CLOUDFLARE_API_KEY="+key)
	}
	if key := config.GetString("cloudflare_account_id"); key != "" && key != "your_cloudflare_account_id_here" {
		env = append(env, "CLOUDFLARE_ACCOUNT_ID="+key)
	}
	if key := config.GetString("tmdb_api_key"); key != "" && key != "your_tmdb_api_key_here" {
		env = append(env, "TMDB_API_KEY="+key)
	}
	if key := config.GetString("deepgram_api_key"); key != "" && key != "your_deepgram_api_key_here" {
		env = append(env, "DEEPGRAM_API_KEY="+key)
	}

	// Start standalone server with watch mode
	fmt.Println(colorYellow + "🚀 Starting standalone Lambda server (watch mode)..." + colorReset)
	cmd := exec.CommandContext(ls.ctx, "npm", "run", "dev:local")
	cmd.Dir = lambdaDir
	cmd.Env = env
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Set process group so child processes are killed when parent exits
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("npm run dev:local failed: %w", err)
	}

	ls.lambdaCmd = cmd

	// Wait a moment for server to start
	time.Sleep(2 * time.Second)

	return nil
}

// stopLambda stops the Lambda (Docker container or standalone server)
func (ls *LocalStack) stopLambda() error {
	// Phase 1: Kill any orphaned processes on the Lambda port (brute force cleanup)
	// This handles processes from previous runs that may have been orphaned
	var portCleanupCmd *exec.Cmd
	if ls.standaloneMode {
		portCleanupCmd = exec.Command("sh", "-c", "lsof -ti:9001 | xargs kill -9 2>/dev/null || true")
	} else {
		portCleanupCmd = exec.Command("sh", "-c", "lsof -ti:9000 | xargs kill -9 2>/dev/null || true")
	}
	portCleanupCmd.Run() // Ignore errors - port might not be in use
	time.Sleep(500 * time.Millisecond) // Let orphaned processes die

	// Phase 2: Gracefully kill the tracked process (current run)
	if ls.lambdaCmd != nil && ls.lambdaCmd.Process != nil {
		// Kill the entire process group (npm/tsx/node or docker logs + children)
		// Using negative PGID kills all processes in the group
		pgid, err := syscall.Getpgid(ls.lambdaCmd.Process.Pid)
		if err == nil {
			// Try graceful shutdown first
			syscall.Kill(-pgid, syscall.SIGTERM)

			// Wait for process to exit (with timeout)
			done := make(chan error, 1)
			go func() {
				done <- ls.lambdaCmd.Wait()
			}()

			select {
			case <-done:
				// Process exited successfully
			case <-time.After(2 * time.Second):
				// Timeout - force kill
				syscall.Kill(-pgid, syscall.SIGKILL)
				<-done // Wait for force kill to complete
			}
		} else {
			// Fallback to killing just the parent process if we can't get PGID
			ls.lambdaCmd.Process.Kill()
			ls.lambdaCmd.Wait()
		}
	}

	// For Docker mode, also stop the container
	if !ls.standaloneMode {
		cmd := exec.Command("docker", "stop", "lambda-local")
		return cmd.Run()
	}

	return nil
}

// startFrontend starts the Go frontend dev server
func (ls *LocalStack) startFrontend() error {
	// Check if frontend port is available
	if err := checkPortAvailable(ls.config.Port); err != nil {
		return err
	}

	cmd := exec.CommandContext(ls.ctx, "go", "run", ".", "serve", "--port", ls.config.Port)
	cmd.Dir = "."

	// Override config to use local services
	cmd.Env = append(os.Environ(),
		"SUPABASE_URL="+ls.config.SupabaseURL,
		"SUPABASE_ANON_KEY="+ls.config.SupabaseKey,
		"LAMBDA_ENDPOINT="+ls.config.LambdaEndpoint,
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Set process group so child processes are killed when parent exits
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start frontend server: %w", err)
	}

	ls.frontendCmd = cmd

	// Wait a moment for server to start
	time.Sleep(1 * time.Second)

	return nil
}

// stopFrontend stops the frontend dev server
func (ls *LocalStack) stopFrontend() error {
	// Phase 1: Kill any orphaned processes on the frontend port (brute force cleanup)
	// This handles processes from previous runs that may have been orphaned
	frontendPort := fmt.Sprintf("%d", ls.config.Port)
	portCleanupCmd := exec.Command("sh", "-c", fmt.Sprintf("lsof -ti:%s | xargs kill -9 2>/dev/null || true", frontendPort))
	portCleanupCmd.Run() // Ignore errors - port might not be in use
	time.Sleep(500 * time.Millisecond) // Let orphaned processes die

	// Phase 2: Gracefully kill the tracked process (current run)
	if ls.frontendCmd != nil && ls.frontendCmd.Process != nil {
		// Kill the entire process group (go run + compiled binary)
		// Using negative PGID kills all processes in the group
		pgid, err := syscall.Getpgid(ls.frontendCmd.Process.Pid)
		if err == nil {
			// Try graceful shutdown first
			syscall.Kill(-pgid, syscall.SIGTERM)

			// Wait for process to exit (with timeout)
			done := make(chan error, 1)
			go func() {
				done <- ls.frontendCmd.Wait()
			}()

			select {
			case <-done:
				// Process exited successfully
			case <-time.After(2 * time.Second):
				// Timeout - force kill
				syscall.Kill(-pgid, syscall.SIGKILL)
				<-done // Wait for force kill to complete
			}
		} else {
			// Fallback to killing just the parent process if we can't get PGID
			ls.frontendCmd.Process.Kill()
			ls.frontendCmd.Wait()
		}
	}
	return nil
}

// WaitForInterrupt waits for Ctrl+C and handles graceful shutdown
func (ls *LocalStack) WaitForInterrupt() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	fmt.Println() // New line after ^C

	if err := ls.Stop(); err != nil {
		os.Exit(1)
	}
}

// Reset resets the Supabase database
func ResetSupabaseDatabase() error {
	fmt.Println(colorYellow + "🔄 Resetting Supabase database..." + colorReset)

	cmd := exec.Command("npx", "supabase", "db", "reset")
	cmd.Dir = "."
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("database reset failed: %w", err)
	}

	fmt.Println(colorGreen + "✅ Database reset complete" + colorReset)
	return nil
}

// TailLogs tails logs from running services
func TailLogs() error {
	fmt.Println(colorCyan + "📋 Tailing logs from local services..." + colorReset)
	fmt.Println(colorYellow + "Press Ctrl+C to stop" + colorReset)
	fmt.Println()

	// Check if Lambda container is running
	checkCmd := exec.Command("docker", "ps", "-q", "-f", "name=lambda-local")
	output, _ := checkCmd.Output()
	lambdaRunning := len(strings.TrimSpace(string(output))) > 0

	if !lambdaRunning {
		return fmt.Errorf("Lambda container is not running. Start local stack with: go run . local")
	}

	// Tail Lambda logs
	cmd := exec.Command("docker", "logs", "-f", "lambda-local")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return cmd.Run()
}
