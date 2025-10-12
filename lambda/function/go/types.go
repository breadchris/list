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

// LibgenSearchRequest contains parameters for a Libgen book search
type LibgenSearchRequest struct {
	Query      string            `json:"query"`                 // Search query
	SearchType string            `json:"search_type,omitempty"` // "default", "title", "author"
	Topics     []string          `json:"topics,omitempty"`      // "libgen", "fiction", "comics", etc.
	Filters    map[string]string `json:"filters,omitempty"`     // Optional filters (year, extension, etc.)
}

// BookInfo represents information about a single book from Libgen
type BookInfo struct {
	ID        string   `json:"id"`        // Book ID
	Title     string   `json:"title"`     // Book title
	Author    string   `json:"author"`    // Author name
	Publisher string   `json:"publisher"` // Publisher name
	Year      string   `json:"year"`      // Publication year
	Language  string   `json:"language"`  // Book language
	Pages     string   `json:"pages"`     // Number of pages
	Size      string   `json:"size"`      // File size
	Extension string   `json:"extension"` // File format (pdf, epub, etc.)
	MD5       string   `json:"md5"`       // MD5 hash
	Mirrors   []string `json:"mirrors"`   // Download mirror URLs
}

// LibgenSearchResponse contains the results of a Libgen search
type LibgenSearchResponse struct {
	Books []BookInfo `json:"books"` // List of found books
	Query string     `json:"query"` // Original search query
}
