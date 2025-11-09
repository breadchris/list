package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// SupabaseClient handles interactions with Supabase REST API
type SupabaseClient struct {
	BaseURL string
	APIKey  string
	Client  *http.Client
}

// NewSupabaseClient creates a new Supabase client
func NewSupabaseClient(baseURL, apiKey string) *SupabaseClient {
	return &SupabaseClient{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Client:  &http.Client{},
	}
}

// InsertContent inserts a new content item into Supabase
func (s *SupabaseClient) InsertContent(content ContentInsert) (*ContentResponse, error) {
	url := fmt.Sprintf("%s/rest/v1/content", s.BaseURL)

	// Marshal content to JSON
	jsonData, err := json.Marshal(content)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal content: %w", err)
	}

	// Create request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.APIKey)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))
	req.Header.Set("Prefer", "return=representation")

	// Execute request
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("supabase error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var contentResponses []ContentResponse
	if err := json.Unmarshal(body, &contentResponses); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(contentResponses) == 0 {
		return nil, fmt.Errorf("no content created")
	}

	return &contentResponses[0], nil
}

// GetGroupMemberships retrieves a user's group memberships from Supabase
func (s *SupabaseClient) GetGroupMemberships(userID string) ([]GroupMembership, error) {
	url := fmt.Sprintf("%s/rest/v1/group_memberships?user_id=eq.%s&select=group_id,groups(id,name)", s.BaseURL, userID)

	// Create request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("apikey", s.APIKey)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	// Execute request
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supabase error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var memberships []GroupMembership
	if err := json.Unmarshal(body, &memberships); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return memberships, nil
}

// GetGroup retrieves a group by ID from Supabase
func (s *SupabaseClient) GetGroup(groupID string) (*Group, error) {
	url := fmt.Sprintf("%s/rest/v1/groups?id=eq.%s&select=id,name", s.BaseURL, groupID)

	// Create request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("apikey", s.APIKey)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	// Execute request
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supabase error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var groups []Group
	if err := json.Unmarshal(body, &groups); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(groups) == 0 {
		return nil, fmt.Errorf("group not found")
	}

	return &groups[0], nil
}
