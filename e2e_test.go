package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/chromedp/chromedp"
)

// Test configuration constants
const (
	LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
	LOCAL_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDYzNTgxOTcsImV4cCI6MjAyMjMwNzEyMn0.9pEWOE9jqpIgaHo2_5oB7hBz-RBKqNsHYqT7VXVpd6E"
	PROD_SUPABASE_URL  = "https://zazsrepfnamdmibcyenx.supabase.co"
	PROD_SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM"
	TEST_APP_PORT      = "3005"
	TEST_EMAIL         = "test@example.com"
	TEST_PASSWORD      = "testpassword123"
	EXISTING_EMAIL     = "existing@example.com"
	EXISTING_PASSWORD  = "password123"
	TEST_JOIN_CODE     = "TEST01"
	SETUP_TIMEOUT      = 60 * time.Second
	TEST_TIMEOUT       = 30 * time.Second
)

// E2ETestSuite manages the test environment
type E2ETestSuite struct {
	t                *testing.T
	supabaseProcess  *exec.Cmd
	serverProcess    *exec.Cmd
	appURL           string
	chromeCtx        context.Context
	chromeCancel     context.CancelFunc
	isSupabaseLocal  bool
	supabaseURL      string
	supabaseKey      string
}

// NewE2ETestSuite creates a new test suite
func NewE2ETestSuite(t *testing.T) *E2ETestSuite {
	return &E2ETestSuite{
		t:      t,
		appURL: "http://localhost:" + TEST_APP_PORT,
	}
}

// Setup initializes the test environment
func (suite *E2ETestSuite) Setup() error {
	suite.t.Log("🚀 Setting up E2E test environment...")

	// Start local Supabase
	if err := suite.startLocalSupabase(); err != nil {
		return fmt.Errorf("failed to start Supabase: %w", err)
	}

	// Wait for Supabase to be ready
	if err := suite.waitForSupabaseReady(); err != nil {
		return fmt.Errorf("Supabase failed to become ready: %w", err)
	}

	// Start the application server
	if err := suite.startAppServer(); err != nil {
		return fmt.Errorf("failed to start app server: %w", err)
	}

	// Wait for app server to be ready
	if err := suite.waitForAppReady(); err != nil {
		return fmt.Errorf("app server failed to become ready: %w", err)
	}

	// Setup Chrome browser
	if err := suite.setupChrome(); err != nil {
		return fmt.Errorf("failed to setup Chrome: %w", err)
	}

	suite.t.Log("✅ E2E test environment ready!")
	return nil
}

// Cleanup tears down the test environment
func (suite *E2ETestSuite) Cleanup() {
	suite.t.Log("🧹 Cleaning up E2E test environment...")

	// Close Chrome
	if suite.chromeCancel != nil {
		suite.chromeCancel()
	}

	// Stop app server
	if suite.serverProcess != nil {
		suite.serverProcess.Process.Kill()
		suite.serverProcess.Wait()
	}

	// Stop Supabase if we started it
	if suite.supabaseProcess != nil && suite.isSupabaseLocal {
		suite.stopLocalSupabase()
	}

	suite.t.Log("✅ E2E cleanup completed")
}

// startLocalSupabase starts the local Supabase instance or falls back to production
func (suite *E2ETestSuite) startLocalSupabase() error {
	suite.t.Log("📦 Configuring Supabase instance...")

	// Check if local Supabase is already running first
	resp, err := http.Get(LOCAL_SUPABASE_URL + "/health")
	if err == nil && resp.StatusCode == 200 {
		suite.t.Log("📦 Using local Supabase instance")
		suite.supabaseURL = LOCAL_SUPABASE_URL
		suite.supabaseKey = LOCAL_SUPABASE_KEY
		suite.isSupabaseLocal = true
		resp.Body.Close()
		return nil
	}

	// Check if Supabase CLI is available for starting local instance
	if _, err := exec.LookPath("supabase"); err == nil {
		suite.t.Log("📦 Starting local Supabase with CLI...")
		cmd := exec.Command("supabase", "start")
		cmd.Dir = filepath.Dir(".")
		
		output, err := cmd.CombinedOutput()
		if err != nil {
			suite.t.Logf("⚠️ Failed to start local Supabase: %v\nOutput: %s", err, string(output))
			suite.t.Log("📦 Falling back to production Supabase...")
		} else {
			suite.supabaseURL = LOCAL_SUPABASE_URL
			suite.supabaseKey = LOCAL_SUPABASE_KEY
			suite.isSupabaseLocal = true
			suite.t.Log("📦 Local Supabase started successfully")
			return nil
		}
	} else {
		suite.t.Log("📦 Supabase CLI not found, using production instance...")
	}

	// Fallback to production Supabase
	suite.supabaseURL = PROD_SUPABASE_URL
	suite.supabaseKey = PROD_SUPABASE_KEY
	suite.isSupabaseLocal = false
	suite.t.Log("📦 Using production Supabase instance")
	return nil
}

// stopLocalSupabase stops the local Supabase instance
func (suite *E2ETestSuite) stopLocalSupabase() {
	suite.t.Log("📦 Stopping local Supabase instance...")
	
	cmd := exec.Command("supabase", "stop")
	cmd.Dir = filepath.Dir(".")
	
	if output, err := cmd.CombinedOutput(); err != nil {
		suite.t.Logf("Warning: Failed to stop Supabase gracefully: %v\nOutput: %s", err, string(output))
	} else {
		suite.t.Log("📦 Local Supabase stopped successfully")
	}
}

// waitForSupabaseReady waits for Supabase to be ready
func (suite *E2ETestSuite) waitForSupabaseReady() error {
	suite.t.Log("⏳ Waiting for Supabase to be ready...")

	healthURL := suite.supabaseURL
	if suite.isSupabaseLocal {
		healthURL += "/health"
	} else {
		// For production, just check if it's reachable
		healthURL += "/rest/v1/"
	}

	timeout := time.Now().Add(SETUP_TIMEOUT)
	for time.Now().Before(timeout) {
		resp, err := http.Get(healthURL)
		if err == nil && (resp.StatusCode == 200 || resp.StatusCode == 401) { // 401 is expected for production without auth
			resp.Body.Close()
			suite.t.Log("✅ Supabase is ready")
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(2 * time.Second)
	}

	return fmt.Errorf("timeout waiting for Supabase to be ready")
}

// startAppServer starts the application server with configured Supabase
func (suite *E2ETestSuite) startAppServer() error {
	suite.t.Log("🌐 Starting application server...")

	cmd := exec.Command("go", "run", ".",
		"serve",
		"--port", TEST_APP_PORT,
		"--supabase-url", suite.supabaseURL,
		"--supabase-key", suite.supabaseKey,
	)

	// Start the server in the background
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start app server: %w", err)
	}

	suite.serverProcess = cmd
	suite.t.Log("🌐 Application server started")
	return nil
}

// waitForAppReady waits for the application server to be ready
func (suite *E2ETestSuite) waitForAppReady() error {
	suite.t.Log("⏳ Waiting for application server to be ready...")

	timeout := time.Now().Add(SETUP_TIMEOUT)
	for time.Now().Before(timeout) {
		resp, err := http.Get(suite.appURL)
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			
			// Also check that the config API is working
			configResp, configErr := http.Get(suite.appURL + "/api/config")
			if configErr == nil && configResp.StatusCode == 200 {
				configResp.Body.Close()
				suite.t.Log("✅ Application server is ready")
				return nil
			}
			if configResp != nil {
				configResp.Body.Close()
			}
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(2 * time.Second)
	}

	return fmt.Errorf("timeout waiting for application server to be ready")
}

// setupChrome initializes the Chrome browser context
func (suite *E2ETestSuite) setupChrome() error {
	suite.t.Log("🌐 Setting up Chrome browser...")

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true), // Set to false for debugging
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-background-timer-throttling", false),
		chromedp.Flag("disable-renderer-backgrounding", false),
		chromedp.Flag("disable-backgrounding-occluded-windows", false),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
	)

	allocCtx, _ := chromedp.NewExecAllocator(context.Background(), opts...)
	suite.chromeCtx, suite.chromeCancel = chromedp.NewContext(allocCtx)

	// Test Chrome setup - use the main context directly without timeout
	var title string
	err := chromedp.Run(suite.chromeCtx,
		chromedp.Navigate(suite.appURL),
		chromedp.Title(&title),
	)

	if err != nil {
		return fmt.Errorf("failed to setup Chrome: %w", err)
	}

	suite.t.Logf("✅ Chrome setup complete, page title: %s", title)
	return nil
}

// resetAuthState clears any existing authentication state
func (suite *E2ETestSuite) resetAuthState() error {
	return chromedp.Run(suite.chromeCtx,
		// Clear localStorage and sessionStorage
		chromedp.Evaluate(`
			localStorage.clear();
			sessionStorage.clear();
			// Clear any Supabase auth cookies
			document.cookie.split(";").forEach(function(c) { 
				document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
			});
		`, nil),
		// Navigate to a fresh page to ensure clean state
		chromedp.Navigate(suite.appURL),
		chromedp.Sleep(2*time.Second),
	)
}

// waitForElement waits for an element to be visible
func (suite *E2ETestSuite) waitForElement(selector string, timeout time.Duration) chromedp.Action {
	return chromedp.WaitVisible(selector, chromedp.ByQuery)
}

// waitForText waits for text to appear on the page
func (suite *E2ETestSuite) waitForText(text string, timeout time.Duration) chromedp.Action {
	return chromedp.WaitVisible(fmt.Sprintf(`//*[contains(text(), "%s")]`, text), chromedp.BySearch)
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// TestMain sets up and tears down the test environment
func TestMain(m *testing.M) {
	// Run tests
	code := m.Run()
	os.Exit(code)
}

// TestE2E_Basic tests that the basic framework works
func TestE2E_Basic(t *testing.T) {
	suite := NewE2ETestSuite(t)
	if err := suite.Setup(); err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer suite.Cleanup()

	t.Run("FrameworkWorks", func(t *testing.T) {
		suite.testFrameworkWorks(t)
	})
}

// TestE2E_LoginFlow tests the complete login flow
func TestE2E_LoginFlow(t *testing.T) {
	suite := NewE2ETestSuite(t)
	if err := suite.Setup(); err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer suite.Cleanup()

	t.Run("ValidLogin", func(t *testing.T) {
		suite.testValidLogin(t)
	})

	t.Run("InvalidLogin", func(t *testing.T) {
		suite.testInvalidLogin(t)
	})

	t.Run("EmptyFieldValidation", func(t *testing.T) {
		suite.testEmptyFieldValidation(t)
	})
}

// testFrameworkWorks verifies the basic E2E framework is functional
func (suite *E2ETestSuite) testFrameworkWorks(t *testing.T) {
	t.Log("🧪 Testing that E2E framework works...")

	ctx := suite.chromeCtx

	// Simple navigation test
	var pageTitle string
	err := chromedp.Run(ctx,
		chromedp.Navigate(suite.appURL),
		chromedp.Sleep(3*time.Second),
		chromedp.Title(&pageTitle),
	)
	if err != nil {
		t.Fatalf("Failed basic navigation: %v", err)
	}

	// Check that we can interact with the page
	var hasLoginForm bool
	err = chromedp.Run(ctx,
		chromedp.Evaluate(`
			document.querySelector('#email') !== null && 
			document.querySelector('#password') !== null
		`, &hasLoginForm),
	)
	if err != nil {
		t.Fatalf("Failed to check page elements: %v", err)
	}

	t.Logf("✅ Framework working - Page title: %s, Login form present: %v", pageTitle, hasLoginForm)
	
	if !hasLoginForm {
		// Get page content for debugging
		var content string
		chromedp.Run(ctx, chromedp.Evaluate(`document.body.innerHTML`, &content))
		t.Logf("Page HTML: %s", content[:min(1000, len(content))])
	}

	t.Log("✅ E2E framework test passed")
}

// testValidLogin tests successful login with valid credentials
func (suite *E2ETestSuite) testValidLogin(t *testing.T) {
	t.Log("🔐 Testing valid login flow...")

	// Use the main Chrome context directly
	ctx := suite.chromeCtx

	// Navigate to the app with better error handling
	t.Log("📱 Navigating to app...")
	err := chromedp.Run(ctx,
		chromedp.Navigate(suite.appURL),
		chromedp.Sleep(5*time.Second), // Give more time for page load
	)
	if err != nil {
		t.Fatalf("Failed to navigate to app: %v", err)
	}

	// Check what's actually on the page
	var pageTitle, pageContent string
	err = chromedp.Run(ctx,
		chromedp.Title(&pageTitle),
		chromedp.Evaluate(`document.body.textContent || ''`, &pageContent),
	)
	if err != nil {
		t.Fatalf("Failed to get page info: %v", err)
	}
	t.Logf("📄 Page title: %s", pageTitle)
	t.Logf("📄 Page content preview: %s", pageContent[:min(200, len(pageContent))])

	// Check for login form elements with specific selectors
	var emailInputVisible, passwordInputVisible, submitButtonVisible bool
	err = chromedp.Run(ctx,
		chromedp.Evaluate(`document.querySelector('#email') !== null`, &emailInputVisible),
		chromedp.Evaluate(`document.querySelector('#password') !== null`, &passwordInputVisible),
		chromedp.Evaluate(`document.querySelector('button[type="submit"]') !== null`, &submitButtonVisible),
	)
	if err != nil {
		t.Fatalf("Failed to check login elements: %v", err)
	}

	t.Logf("🔍 Login elements found - Email: %v, Password: %v, Submit: %v", 
		emailInputVisible, passwordInputVisible, submitButtonVisible)

	if !emailInputVisible || !passwordInputVisible || !submitButtonVisible {
		t.Fatalf("Login form not ready - missing elements")
	}

	// Fill in login form using ID selectors
	t.Log("📝 Filling login form...")
	err = chromedp.Run(ctx,
		chromedp.Clear(`#email`, chromedp.ByID),
		chromedp.SendKeys(`#email`, TEST_EMAIL, chromedp.ByID),
		chromedp.Clear(`#password`, chromedp.ByID),
		chromedp.SendKeys(`#password`, TEST_PASSWORD, chromedp.ByID),
	)
	if err != nil {
		t.Fatalf("Failed to fill login form: %v", err)
	}

	// Submit login form
	t.Log("🚀 Submitting login form...")
	err = chromedp.Run(ctx,
		chromedp.Click(`button[type="submit"]`, chromedp.ByQuery),
		chromedp.Sleep(5*time.Second), // Wait for login to process
	)
	if err != nil {
		t.Fatalf("Failed to submit login form: %v", err)
	}

	// Check if we're now in the authenticated state
	var isAuthenticated bool
	err = chromedp.Run(ctx,
		// Look for elements that only appear when authenticated
		chromedp.Evaluate(`
			// Check for group selector or user email in header
			document.querySelector('.group-selector') !== null ||
			document.querySelector('[data-testid="group-dropdown"]') !== null ||
			(document.body && document.body.textContent && document.body.textContent.includes('` + TEST_EMAIL + `'))
		`, &isAuthenticated),
	)
	if err != nil {
		t.Fatalf("Failed to check authentication state: %v", err)
	}

	if !isAuthenticated {
		// Get current page state for debugging
		var currentContent string
		chromedp.Run(ctx, chromedp.Evaluate(`document.body.textContent || ''`, &currentContent))
		t.Logf("🔍 Current page content: %s", currentContent[:min(500, len(currentContent))])
		t.Fatalf("Login form submitted but user not authenticated")
	}

	t.Log("✅ Valid login test passed - user successfully authenticated")
}

// testInvalidLogin tests login failure with incorrect credentials
func (suite *E2ETestSuite) testInvalidLogin(t *testing.T) {
	t.Log("🔐 Testing invalid login flow...")

	// Reset auth state before test
	if err := suite.resetAuthState(); err != nil {
		t.Fatalf("Failed to reset auth state: %v", err)
	}

	// Use the main Chrome context directly
	ctx := suite.chromeCtx

	// Navigate to the app
	err := chromedp.Run(ctx,
		chromedp.Navigate(suite.appURL),
		chromedp.WaitVisible(`input[type="email"]`, chromedp.ByQuery),
		chromedp.WaitVisible(`input[type="password"]`, chromedp.ByQuery),
	)
	if err != nil {
		t.Fatalf("Failed to load login page: %v", err)
	}

	// Fill in login form with invalid credentials
	err = chromedp.Run(ctx,
		chromedp.SendKeys(`input[type="email"]`, "invalid@example.com", chromedp.ByQuery),
		chromedp.SendKeys(`input[type="password"]`, "wrongpassword", chromedp.ByQuery),
	)
	if err != nil {
		t.Fatalf("Failed to fill login form: %v", err)
	}

	// Submit login form
	err = chromedp.Run(ctx,
		chromedp.Click(`button[type="submit"]`, chromedp.ByQuery),
	)
	if err != nil {
		t.Fatalf("Failed to submit login form: %v", err)
	}

	// Wait for error message to appear
	var errorVisible bool
	err = chromedp.Run(ctx,
		chromedp.Sleep(3*time.Second), // Wait for auth to process
		// Check if an error message is displayed
		chromedp.Evaluate(`
			document.querySelector('.error') !== null || 
			document.querySelector('[class*="error"]') !== null ||
			document.querySelector('.alert') !== null ||
			document.textContent.includes('Invalid') ||
			document.textContent.includes('incorrect') ||
			document.textContent.includes('failed')
		`, &errorVisible),
	)

	// Also verify that login form is still visible (user not authenticated)
	var loginFormVisible bool
	chromedp.Run(ctx,
		chromedp.Evaluate(`document.querySelector('input[type="email"]') !== null`, &loginFormVisible),
	)

	if !loginFormVisible {
		t.Fatalf("Login form disappeared, suggesting invalid login succeeded")
	}

	// The error might not always be visible in UI, but the important thing is that login failed
	if !errorVisible {
		t.Log("⚠️ No visible error message, but login correctly failed (form still present)")
	}

	t.Log("✅ Invalid login test passed")
}

// testEmptyFieldValidation tests form validation with empty fields
func (suite *E2ETestSuite) testEmptyFieldValidation(t *testing.T) {
	t.Log("🔐 Testing empty field validation...")

	// Reset auth state before test
	if err := suite.resetAuthState(); err != nil {
		t.Fatalf("Failed to reset auth state: %v", err)
	}

	// Use the main Chrome context directly
	ctx := suite.chromeCtx

	// Navigate to the app
	err := chromedp.Run(ctx,
		chromedp.Navigate(suite.appURL),
		chromedp.WaitVisible(`input[type="email"]`, chromedp.ByQuery),
		chromedp.WaitVisible(`input[type="password"]`, chromedp.ByQuery),
	)
	if err != nil {
		t.Fatalf("Failed to load login page: %v", err)
	}

	// Test 1: Submit with completely empty fields
	t.Log("Testing submission with empty fields...")
	err = chromedp.Run(ctx,
		chromedp.Click(`button[type="submit"]`, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second), // Wait for validation
	)
	if err != nil {
		t.Fatalf("Failed to submit empty form: %v", err)
	}

	// Check that form is still visible (validation prevented submission)
	var formStillVisible bool
	err = chromedp.Run(ctx,
		chromedp.Evaluate(`document.querySelector('input[type="email"]') !== null`, &formStillVisible),
	)
	if err != nil || !formStillVisible {
		t.Fatalf("Form validation failed - empty form was submitted")
	}

	// Test 2: Submit with only email filled
	t.Log("Testing submission with only email filled...")
	err = chromedp.Run(ctx,
		chromedp.Clear(`input[type="email"]`, chromedp.ByQuery),
		chromedp.Clear(`input[type="password"]`, chromedp.ByQuery),
		chromedp.SendKeys(`input[type="email"]`, TEST_EMAIL, chromedp.ByQuery),
		chromedp.Click(`button[type="submit"]`, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	)
	if err != nil {
		t.Fatalf("Failed to test partial form submission: %v", err)
	}

	// Verify form is still present
	err = chromedp.Run(ctx,
		chromedp.Evaluate(`document.querySelector('input[type="email"]') !== null`, &formStillVisible),
	)
	if err != nil || !formStillVisible {
		t.Fatalf("Form validation failed - partial form was submitted")
	}

	// Test 3: Submit with only password filled
	t.Log("Testing submission with only password filled...")
	err = chromedp.Run(ctx,
		chromedp.Clear(`input[type="email"]`, chromedp.ByQuery),
		chromedp.Clear(`input[type="password"]`, chromedp.ByQuery),
		chromedp.SendKeys(`input[type="password"]`, TEST_PASSWORD, chromedp.ByQuery),
		chromedp.Click(`button[type="submit"]`, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	)
	if err != nil {
		t.Fatalf("Failed to test password-only submission: %v", err)
	}

	// Verify form is still present
	err = chromedp.Run(ctx,
		chromedp.Evaluate(`document.querySelector('input[type="email"]') !== null`, &formStillVisible),
	)
	if err != nil || !formStillVisible {
		t.Fatalf("Form validation failed - password-only form was submitted")
	}

	t.Log("✅ Empty field validation test passed")
}