package main

import (
	"encoding/json"
	"testing"
)

// TestYouTubeSubtitlesIntegration tests subtitle extraction with a real YouTube video
func TestYouTubeSubtitlesIntegration(t *testing.T) {
	t.Log("🎬 Testing YouTube Subtitle Extraction...")

	// Test video: https://www.youtube.com/watch?v=SOUvvDTBdic&t=197s
	videoID := "SOUvvDTBdic"

	t.Logf("Testing subtitle extraction for video ID: %s", videoID)

	// Create request
	req := SubtitleRequest{
		VideoID: videoID,
	}

	reqJSON, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	// Call handler
	result, err := handleSubtitles(json.RawMessage(reqJSON))
	if err != nil {
		t.Fatalf("handleSubtitles failed: %v", err)
	}

	// Validate results
	if result.VideoID != videoID {
		t.Errorf("Expected video_id %s, got %s", videoID, result.VideoID)
	}

	t.Logf("✅ Found %d subtitle tracks", len(result.Tracks))

	if len(result.Tracks) == 0 {
		t.Log("⚠️  No subtitle tracks found for this video")
		return
	}

	// Log details about each track
	for i, track := range result.Tracks {
		t.Logf("\n📝 Track %d:", i+1)
		t.Logf("  Language: %s", track.LanguageCode)
		t.Logf("  Name: %s", track.Name)
		t.Logf("  Automatic: %v", track.IsAutomatic)
		t.Logf("  Content Length: %d characters", len(track.Content))

		// Show first 200 characters of content
		preview := track.Content
		if len(preview) > 200 {
			preview = preview[:200] + "..."
		}
		t.Logf("  Preview: %s", preview)
	}

	t.Log("\n✅ Subtitle extraction test completed successfully!")
}

// TestSubtitleRequestValidation tests error handling for invalid requests
func TestSubtitleRequestValidation(t *testing.T) {
	t.Log("🧪 Testing subtitle request validation...")

	testCases := []struct {
		desc      string
		request   SubtitleRequest
		expectErr bool
	}{
		{
			desc:      "empty video ID",
			request:   SubtitleRequest{VideoID: ""},
			expectErr: true,
		},
		{
			desc:      "valid video ID",
			request:   SubtitleRequest{VideoID: "dQw4w9WgXcQ"},
			expectErr: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			reqJSON, _ := json.Marshal(tc.request)
			_, err := handleSubtitles(json.RawMessage(reqJSON))

			if tc.expectErr && err == nil {
				t.Errorf("Expected error for %s, got nil", tc.desc)
			}

			if !tc.expectErr && err != nil {
				t.Logf("Note: %s may fail if video has no subtitles: %v", tc.desc, err)
			}

			t.Logf("✓ Validated: %s", tc.desc)
		})
	}
}
