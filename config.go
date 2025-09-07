package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port        string `json:"port"`
	SupabaseURL string `json:"supabase_url"`
	SupabaseKey string `json:"supabase_key"`
}

func LoadConfig() (*Config, error) {
	// Default configuration
	config := &Config{
		Port:        "3002",
		SupabaseURL: "https://zazsrepfnamdmibcyenx.supabase.co",
		SupabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM",
	}

	// Try to load from config file if it exists
	configPath := filepath.Join(".", "config.json")
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		if err := json.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}
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

	return config, nil
}

// LoadDatabaseConfig loads database configuration and returns a database URL
func LoadDatabaseConfig(configPath string) (string, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", fmt.Errorf("failed to read config file: %w", err)
	}

	var config struct {
		SupabaseURL string `json:"supabase_url"`
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return "", fmt.Errorf("failed to parse config file: %w", err)
	}

	// Convert Supabase URL to PostgreSQL database URL
	// Extract the project ID from the Supabase URL
	// Example: https://zazsrepfnamdmibcyenx.supabase.co -> zazsrepfnamdmibcyenx
	url := strings.TrimPrefix(config.SupabaseURL, "https://")
	url = strings.TrimPrefix(url, "http://")
	projectID := strings.Split(url, ".")[0]
	
	// Construct the PostgreSQL connection string for Supabase
	dbURL := fmt.Sprintf("postgresql://postgres:postgres@db.%s.supabase.co:5432/postgres?sslmode=require", projectID)
	return dbURL, nil
}
