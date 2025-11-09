package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port           string                 `json:"port"`
	SupabaseURL    string                 `json:"supabase_url"`
	SupabaseKey    string                 `json:"supabase_key"`
	LambdaEndpoint string                 `json:"lambda_endpoint"`
	Extra          map[string]interface{} `json:"-"` // For additional fields like API keys
}

func LoadConfig() (*Config, error) {
	return LoadConfigFromPath(filepath.Join("data", "config.json"))
}

// LoadConfigFromPath loads configuration from a specific path
func LoadConfigFromPath(configPath string) (*Config, error) {
	// Default configuration
	config := &Config{
		Port:           "3002",
		SupabaseURL:    "https://zazsrepfnamdmibcyenx.supabase.co",
		SupabaseKey:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM",
		LambdaEndpoint: "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content",
		Extra:          make(map[string]interface{}),
	}

	// Try to load from config file if it exists
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		// Parse as map to capture all fields
		var configMap map[string]interface{}
		if err := json.Unmarshal(data, &configMap); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}

		// Extract known fields
		if port, ok := configMap["port"].(string); ok {
			config.Port = port
		}
		if supabaseURL, ok := configMap["supabase_url"].(string); ok {
			config.SupabaseURL = supabaseURL
		}
		if supabaseKey, ok := configMap["supabase_key"].(string); ok {
			config.SupabaseKey = supabaseKey
		}
		if lambdaEndpoint, ok := configMap["lambda_endpoint"].(string); ok {
			config.LambdaEndpoint = lambdaEndpoint
		}

		// Store all fields in Extra for access by local stack
		config.Extra = configMap
	}

	// Override with environment variables if set
	if port := os.Getenv("PORT"); port != "" {
		config.Port = port
	}
	if supabaseURL := os.Getenv("SUPABASE_URL"); supabaseURL != "" {
		config.SupabaseURL = supabaseURL
	}
	if supabaseKey := os.Getenv("SUPABASE_ANON_KEY"); supabaseKey != "" {
		config.SupabaseKey = supabaseKey
	}
	if lambdaEndpoint := os.Getenv("LAMBDA_ENDPOINT"); lambdaEndpoint != "" {
		config.LambdaEndpoint = lambdaEndpoint
	}

	return config, nil
}

// GetString gets a string value from the config's extra fields
func (c *Config) GetString(key string) string {
	if val, ok := c.Extra[key].(string); ok {
		return val
	}
	return ""
}

// LoadDatabaseConfig loads database configuration and returns a database URL
func LoadDatabaseConfig(configPath string) (string, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", fmt.Errorf("failed to read config file: %w", err)
	}

	var config struct {
		DatabaseURL string `json:"database_url"`
		SupabaseURL string `json:"supabase_url"`
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return "", fmt.Errorf("failed to parse config file: %w", err)
	}

	// If database_url is provided, use it directly
	if config.DatabaseURL != "" {
		return config.DatabaseURL, nil
	}

	// Otherwise, convert Supabase URL to PostgreSQL database URL
	// Extract the project ID from the Supabase URL
	// Example: https://zazsrepfnamdmibcyenx.supabase.co -> zazsrepfnamdmibcyenx
	url := strings.TrimPrefix(config.SupabaseURL, "https://")
	url = strings.TrimPrefix(url, "http://")
	projectID := strings.Split(url, ".")[0]

	// Construct the PostgreSQL connection string for Supabase
	dbURL := fmt.Sprintf("postgresql://postgres:postgres@db.%s.supabase.co:5432/postgres?sslmode=require", projectID)
	return dbURL, nil
}
