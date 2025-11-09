package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// getLambdaURL returns the Lambda URL, trying standalone port (9001) first, then Docker port (9000)
func getLambdaURL() string {
	// Try standalone port 9001 first
	if isPortOpen("localhost:9001") {
		return "http://localhost:9001/2015-03-31/functions/function/invocations"
	}

	// Fallback to Docker port 9000
	return "http://localhost:9000/2015-03-31/functions/function/invocations"
}

// isPortOpen checks if a port is listening
func isPortOpen(address string) bool {
	conn, err := net.DialTimeout("tcp", address, 100*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// handleLambdaProxy forwards requests to local Lambda Runtime Interface Emulator
// This enables browser CORS testing with local Docker Lambda
func handleLambdaProxy(w http.ResponseWriter, r *http.Request) {
	// CORS headers for browser requests
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age":       "86400",
	}

	// Set CORS headers on response
	for key, value := range corsHeaders {
		w.Header().Set(key, value)
	}

	// Handle OPTIONS preflight
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Only handle POST requests
	if r.Method != "POST" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[PROXY] Failed to read request body: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to read request body"})
		return
	}

	// Log request for debugging
	var requestData interface{}
	if err := json.Unmarshal(body, &requestData); err == nil {
		requestJSON, _ := json.MarshalIndent(requestData, "", "  ")
		log.Printf("[PROXY] Request:\n%s\n", string(requestJSON))
	}

	// Forward to local Lambda (try standalone port 9001 first, then Docker port 9000)
	lambdaURL := getLambdaURL()
	lambdaReq, err := http.NewRequest("POST", lambdaURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("[PROXY] Failed to create Lambda request: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Internal Server Error",
			"message": fmt.Sprintf("Failed to create Lambda request: %v", err),
		})
		return
	}

	lambdaReq.Header.Set("Content-Type", "application/json")

	// Send request to Lambda
	client := &http.Client{}
	lambdaResp, err := client.Do(lambdaReq)
	if err != nil {
		log.Printf("[PROXY] Lambda request error: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Bad Gateway",
			"message": fmt.Sprintf("Failed to connect to Lambda: %v", err),
		})
		return
	}
	defer lambdaResp.Body.Close()

	// Read Lambda response
	responseBody, err := io.ReadAll(lambdaResp.Body)
	if err != nil {
		log.Printf("[PROXY] Failed to read Lambda response: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Internal Server Error",
			"message": "Failed to read Lambda response",
		})
		return
	}

	// Try to parse Lambda response as JSON
	var lambdaResponse struct {
		StatusCode int               `json:"statusCode"`
		Headers    map[string]string `json:"headers"`
		Body       string            `json:"body"`
	}

	if err := json.Unmarshal(responseBody, &lambdaResponse); err == nil {
		// Successfully parsed Lambda response format
		log.Printf("[PROXY] Lambda statusCode: %d\n", lambdaResponse.StatusCode)

		// Copy headers from Lambda response (with CORS override)
		for key, value := range lambdaResponse.Headers {
			// Don't override CORS headers
			if !strings.HasPrefix(strings.ToLower(key), "access-control-") {
				w.Header().Set(key, value)
			}
		}

		// Write response
		w.WriteHeader(lambdaResponse.StatusCode)
		w.Write([]byte(lambdaResponse.Body))
	} else {
		// Lambda response isn't in expected format, return as-is
		log.Printf("[PROXY] Failed to parse Lambda response as JSON: %v\n", err)
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write(responseBody)
	}
}

// createHTTPServer creates the HTTP server for the list app
func createHTTPServer() *http.ServeMux {
	mux := http.NewServeMux()

	// Main list app page
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveReactApp(w, r, "index.tsx", "App")
	})

	// Component renderer endpoint for debugging
	mux.HandleFunc("/render/", handleRenderComponent)

	// ES Module endpoint for serving compiled JavaScript
	mux.HandleFunc("/module/", handleServeModule)

	// API endpoint for frontend configuration
	mux.HandleFunc("/api/config", handleAPIConfig)

	// API endpoint for Lambda logs
	mux.HandleFunc("/api/lambda-logs", handleLambdaLogs)

	// Lambda proxy for local development (handles CORS for Docker Lambda)
	mux.HandleFunc("/lambda-proxy", handleLambdaProxy)

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
	//htmlPage := generateComponentHTML(componentName, componentPath)
	htmlPage := generateRenderComponentHTML(componentName, componentPath)
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
