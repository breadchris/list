package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

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
