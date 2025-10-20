package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/kkdai/youtube/v2"
)

// handlePlaylist fetches videos from a YouTube playlist
func handlePlaylist(params json.RawMessage) (*PlaylistResponse, error) {
	var req PlaylistRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return nil, fmt.Errorf("invalid playlist request: %w", err)
	}

	if req.URL == "" {
		return nil, fmt.Errorf("url field is required")
	}

	// Debug: Print the URL being processed
	fmt.Fprintf(os.Stderr, "DEBUG: Received YouTube URL: %s\n", req.URL)

	client := youtube.Client{}
	ctx := context.Background()

	// Get playlist from URL
	playlist, err := client.GetPlaylistContext(ctx, req.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to get playlist: %w", err)
	}

	// Extract video information with full metadata
	videos := make([]VideoInfo, 0, len(playlist.Videos))
	for _, entry := range playlist.Videos {
		// Attempt to fetch full Video object for richer metadata
		video, err := client.VideoFromPlaylistEntryContext(ctx, entry)

		var videoInfo VideoInfo
		if err != nil {
			// Fallback to PlaylistEntry data if full fetch fails
			fmt.Fprintf(os.Stderr, "WARNING: Failed to fetch full video details for %s: %v. Using playlist entry data.\n", entry.ID, err)

			// Convert thumbnails from PlaylistEntry
			thumbnails := make([]Thumbnail, len(entry.Thumbnails))
			for i, thumb := range entry.Thumbnails {
				thumbnails[i] = Thumbnail{
					URL:    thumb.URL,
					Width:  thumb.Width,
					Height: thumb.Height,
				}
			}

			videoInfo = VideoInfo{
				ID:         entry.ID,
				Title:      entry.Title,
				URL:        fmt.Sprintf("https://www.youtube.com/watch?v=%s", entry.ID),
				Duration:   int64(entry.Duration.Seconds()),
				Author:     entry.Author,
				Thumbnails: thumbnails,
			}
		} else {
			// Use full Video object data
			// Convert thumbnails
			thumbnails := make([]Thumbnail, len(video.Thumbnails))
			for i, thumb := range video.Thumbnails {
				thumbnails[i] = Thumbnail{
					URL:    thumb.URL,
					Width:  thumb.Width,
					Height: thumb.Height,
				}
			}

			// Format publish date as ISO 8601
			publishDate := ""
			if !video.PublishDate.IsZero() {
				publishDate = video.PublishDate.Format("2006-01-02T15:04:05Z07:00")
			}

			videoInfo = VideoInfo{
				ID:            video.ID,
				Title:         video.Title,
				URL:           fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.ID),
				Duration:      int64(video.Duration.Seconds()),
				Author:        video.Author,
				ChannelID:     video.ChannelID,
				ChannelHandle: video.ChannelHandle,
				Description:   video.Description,
				Views:         uint64(video.Views),
				PublishDate:   publishDate,
				Thumbnails:    thumbnails,
			}
		}

		videos = append(videos, videoInfo)
	}

	return &PlaylistResponse{
		Videos: videos,
	}, nil
}

// XML structures for parsing YouTube subtitle format
type transcript struct {
	XMLName xml.Name `xml:"transcript"`
	Text    []text   `xml:"text"`
}

type text struct {
	Start    string `xml:"start,attr"`
	Duration string `xml:"dur,attr"`
	Content  string `xml:",chardata"`
}

// handleSubtitles fetches subtitles/captions for a YouTube video
func handleSubtitles(params json.RawMessage) (*SubtitleResponse, error) {
	var req SubtitleRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return nil, fmt.Errorf("invalid subtitle request: %w", err)
	}

	if req.VideoID == "" {
		return nil, fmt.Errorf("video_id field is required")
	}

	fmt.Fprintf(os.Stderr, "DEBUG: Fetching subtitles for video ID: %s\n", req.VideoID)

	client := youtube.Client{}
	ctx := context.Background()

	// Get video info
	video, err := client.GetVideoContext(ctx, req.VideoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get video: %w", err)
	}

	// Check if captions are available
	if video.CaptionTracks == nil || len(video.CaptionTracks) == 0 {
		fmt.Fprintf(os.Stderr, "WARNING: No caption tracks available for video %s\n", req.VideoID)
		return &SubtitleResponse{
			VideoID: req.VideoID,
			Tracks:  []SubtitleTrack{},
		}, nil
	}

	fmt.Fprintf(os.Stderr, "DEBUG: Found %d caption tracks\n", len(video.CaptionTracks))

	// Extract all available subtitle tracks
	tracks := make([]SubtitleTrack, 0, len(video.CaptionTracks))
	for _, caption := range video.CaptionTracks {
		// Fetch subtitle content from BaseURL
		content, err := fetchSubtitleContent(caption.BaseURL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "WARNING: Failed to fetch subtitle content for %s (%s): %v\n",
				caption.LanguageCode, caption.Name.SimpleText, err)
			continue
		}

		// Determine if captions are automatic
		isAutomatic := strings.Contains(strings.ToLower(caption.Name.SimpleText), "auto")

		track := SubtitleTrack{
			LanguageCode: caption.LanguageCode,
			Name:         caption.Name.SimpleText,
			BaseURL:      caption.BaseURL,
			Content:      content,
			IsAutomatic:  isAutomatic,
		}

		tracks = append(tracks, track)
		fmt.Fprintf(os.Stderr, "DEBUG: Successfully fetched subtitle track: %s (%s)\n",
			caption.LanguageCode, caption.Name.SimpleText)
	}

	return &SubtitleResponse{
		VideoID: req.VideoID,
		Tracks:  tracks,
	}, nil
}

// fetchSubtitleContent downloads and parses subtitle XML from YouTube
func fetchSubtitleContent(baseURL string) (string, error) {
	// Fetch subtitle XML
	resp, err := http.Get(baseURL)
	if err != nil {
		return "", fmt.Errorf("failed to fetch subtitle: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("subtitle fetch returned status %d", resp.StatusCode)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read subtitle response: %w", err)
	}

	// Parse XML
	var trans transcript
	if err := xml.Unmarshal(body, &trans); err != nil {
		return "", fmt.Errorf("failed to parse subtitle XML: %w", err)
	}

	// Format subtitle content with timestamps
	var builder strings.Builder
	for i, t := range trans.Text {
		// Decode HTML entities in content
		content := unescapeHTML(t.Content)

		// Format: [timestamp] text
		builder.WriteString(fmt.Sprintf("[%s] %s", t.Start, content))

		// Add newline between subtitle segments
		if i < len(trans.Text)-1 {
			builder.WriteString("\n")
		}
	}

	return builder.String(), nil
}

// unescapeHTML decodes common HTML entities in subtitle text
func unescapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "\n", " ")
	return s
}
