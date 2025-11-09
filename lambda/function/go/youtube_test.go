package main

import (
	"testing"
)

// TestNormalizePlaylistURL tests the URL normalization function
func TestNormalizePlaylistURL(t *testing.T) {
	testCases := []struct {
		inputURL     string
		expectedURL  string
		shouldError  bool
		description  string
	}{
		{
			inputURL:    "https://www.youtube.com/watch?v=LsnEE5ykwCs&list=PLz3-p2q6vFYWzmnkvjYWF3vnxckIRNYEH",
			expectedURL: "https://www.youtube.com/playlist?list=PLz3-p2q6vFYWzmnkvjYWF3vnxckIRNYEH",
			shouldError: false,
			description: "Mixed URL with video ID and playlist ID",
		},
		{
			inputURL:    "https://www.youtube.com/playlist?list=PLz3-p2q6vFYWzmnkvjYWF3vnxckIRNYEH",
			expectedURL: "https://www.youtube.com/playlist?list=PLz3-p2q6vFYWzmnkvjYWF3vnxckIRNYEH",
			shouldError: false,
			description: "Clean playlist URL",
		},
		{
			inputURL:    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj&index=1",
			expectedURL: "https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj",
			shouldError: false,
			description: "Mixed URL with video ID, playlist ID, and index",
		},
		{
			inputURL:    "https://youtu.be/dQw4w9WgXcQ?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj",
			expectedURL: "https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj",
			shouldError: false,
			description: "Short youtu.be URL with playlist",
		},
		{
			inputURL:    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			expectedURL: "",
			shouldError: true,
			description: "Video URL without playlist ID (should error)",
		},
		{
			inputURL:    "https://www.youtube.com/",
			expectedURL: "",
			shouldError: true,
			description: "Homepage URL without playlist ID (should error)",
		},
		{
			inputURL:    "not a url",
			expectedURL: "",
			shouldError: true,
			description: "Invalid URL format (should error)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			normalizedURL, err := normalizePlaylistURL(tc.inputURL)

			if tc.shouldError {
				if err == nil {
					t.Fatalf("Expected error for %s, but got none", tc.description)
				}
				t.Logf("✓ Correctly returned error: %v", err)
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error for %s: %v", tc.description, err)
			}

			if normalizedURL != tc.expectedURL {
				t.Fatalf("URL mismatch for %s:\n  Expected: %s\n  Got:      %s",
					tc.description, tc.expectedURL, normalizedURL)
			}

			t.Logf("✓ Validated: %s", tc.description)
			t.Logf("  Input:  %s", tc.inputURL)
			t.Logf("  Output: %s", normalizedURL)
		})
	}
}

// TestPlaylistIntegration tests the full playlist extraction with real API
// This is a live integration test that validates the fix works end-to-end
func TestPlaylistIntegration(t *testing.T) {
	// Skip in short mode (e.g., CI pipelines)
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	t.Log("🎬 Testing YouTube Playlist Integration (LIVE API)...")

	testCases := []struct {
		url                string
		expectedMinVideos  int
		description        string
	}{
		{
			url:               "https://www.youtube.com/watch?v=LsnEE5ykwCs&list=PLz3-p2q6vFYWzmnkvjYWF3vnxckIRNYEH",
			expectedMinVideos: 1,
			description:       "User-reported failing URL (mixed video + playlist)",
		},
		{
			url:               "https://www.youtube.com/playlist?list=PLz3-p2q6vFYWzmnkvjYWF3vnxckIRNYEH",
			expectedMinVideos: 1,
			description:       "Clean playlist URL for same playlist",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			t.Logf("🔍 Testing URL: %s", tc.url)

			// Create a PlaylistRequest JSON
			requestJSON := []byte(`{"url":"` + tc.url + `"}`)

			// Call handlePlaylist
			response, err := handlePlaylist(requestJSON)
			if err != nil {
				t.Fatalf("Failed to extract playlist: %v", err)
			}

			// Validate response
			if response == nil {
				t.Fatal("Response is nil")
			}

			videoCount := len(response.Videos)
			t.Logf("📊 Found %d videos in playlist", videoCount)

			if videoCount < tc.expectedMinVideos {
				t.Fatalf("Expected at least %d videos, got %d", tc.expectedMinVideos, videoCount)
			}

			// Log first few videos for debugging
			displayCount := 3
			if videoCount < displayCount {
				displayCount = videoCount
			}

			t.Logf("📹 First %d videos:", displayCount)
			for i := 0; i < displayCount; i++ {
				video := response.Videos[i]
				t.Logf("  %d. %s (ID: %s, Duration: %ds)",
					i+1, video.Title, video.ID, video.Duration)
			}

			t.Logf("✅ Successfully extracted playlist with %d videos", videoCount)
		})
	}
}
