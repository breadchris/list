package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Config struct {
	Port         string `json:"port"`
	SupabaseURL  string `json:"supabase_url"`
	SupabaseKey  string `json:"supabase_key"`
}

func LoadConfig() (*Config, error) {
	// Default configuration
	config := &Config{
		Port:        "3002",
		SupabaseURL: "https://qxbfhpisnafbwtrhekyn.supabase.co",
		SupabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4YmZocGlzbmFmYnd0cmhla3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNDkyOTcsImV4cCI6MjA2NjcyNTI5N30.VboPHSbBC6XERXMKbxRLe_NhjzhjRYfctwBPzpz1eAo",
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