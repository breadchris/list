package main

import "encoding/json"

// Request represents an incoming JSON-RPC style request
type Request struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

// Response represents an outgoing JSON-RPC style response
type Response struct {
	Success bool            `json:"success"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   string          `json:"error,omitempty"`
}

// PlaylistRequest contains a YouTube playlist URL
type PlaylistRequest struct {
	URL string `json:"url"`
}

// PlaylistResponse contains the enumerated videos from a playlist
type PlaylistResponse struct {
	Videos []VideoInfo `json:"videos"`
}

// Thumbnail represents a single thumbnail image
type Thumbnail struct {
	URL    string `json:"url"`
	Width  uint   `json:"width"`
	Height uint   `json:"height"`
}

// VideoInfo represents information about a single YouTube video
type VideoInfo struct {
	ID            string      `json:"id"`
	Title         string      `json:"title"`
	URL           string      `json:"url"`
	Duration      int64       `json:"duration"`       // Duration in seconds
	Author        string      `json:"author"`         // Channel name
	ChannelID     string      `json:"channel_id"`     // Channel ID
	ChannelHandle string      `json:"channel_handle"` // Channel handle (e.g., @channelname)
	Description   string      `json:"description"`    // Video description
	Views         uint64      `json:"views"`          // View count
	PublishDate   string      `json:"publish_date"`   // ISO 8601 formatted date
	Thumbnails    []Thumbnail `json:"thumbnails"`     // Video thumbnails
}

// SubtitleRequest contains a YouTube video ID for subtitle extraction
type SubtitleRequest struct {
	VideoID string `json:"video_id"`
}

// SubtitleTrack represents a single subtitle/caption track
type SubtitleTrack struct {
	LanguageCode string `json:"language_code"` // Language code (e.g., "en", "es")
	Name         string `json:"name"`          // Display name (e.g., "English", "English (auto-generated)")
	BaseURL      string `json:"base_url"`      // URL to fetch subtitle content
	Content      string `json:"content"`       // Parsed subtitle text with timestamps
	IsAutomatic  bool   `json:"is_automatic"`  // Whether captions are auto-generated
}

// SubtitleResponse contains all available subtitle tracks for a video
type SubtitleResponse struct {
	VideoID string          `json:"video_id"`
	Tracks  []SubtitleTrack `json:"tracks"`
}

