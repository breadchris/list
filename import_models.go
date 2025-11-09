package main

import (
	"time"
)

// FileIndex represents a file or directory in the import index
type FileIndex struct {
	Path         string    // Absolute path
	RelativePath string    // Path relative to root directory
	Size         int64     // File size in bytes
	Extension    string    // File extension (e.g., ".txt")
	ModTime      time.Time // Last modification time
	IsDir        bool      // Whether this is a directory
	MimeType     string    // MIME type (e.g., "text/plain")
}

// ImportConfig holds configuration for the import operation
type ImportConfig struct {
	RootDir       string            // Root directory to import from
	UserID        string            // Supabase user ID
	GroupID       string            // Supabase group ID
	TypeMappings  map[string]string // File extension to content type mapping
	SkipHidden    bool              // Skip hidden files and directories
	MaxFileSize   int64             // Maximum file size in bytes
	DryRun        bool              // Preview mode without actually importing
	Verbose       bool              // Detailed progress output
	SelectedTypes []string          // File extensions to import
}

// ImportProgress tracks the progress of an import operation
type ImportProgress struct {
	Total       int           // Total items to import
	Processed   int           // Items processed so far
	Succeeded   int           // Successfully imported items
	Failed      int           // Failed imports
	Skipped     int           // Skipped items
	Errors      []ImportError // Collection of errors
	StartTime   time.Time     // When import started
	CurrentFile string        // Current file being processed
}

// ImportError represents an error that occurred during import
type ImportError struct {
	FilePath string // Path to the file that failed
	Error    error  // The error that occurred
}

// ContentInsert represents data for inserting into Supabase content table
type ContentInsert struct {
	Type             string                 `json:"type"`
	Data             string                 `json:"data"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	UserID           string                 `json:"user_id"`
	GroupID          string                 `json:"group_id"`
	ParentContentID  *string                `json:"parent_content_id,omitempty"`
}

// ContentResponse represents the response from Supabase after inserting content
type ContentResponse struct {
	ID              string                 `json:"id"`
	Type            string                 `json:"type"`
	Data            string                 `json:"data"`
	Metadata        map[string]interface{} `json:"metadata"`
	UserID          string                 `json:"user_id"`
	GroupID         string                 `json:"group_id"`
	ParentContentID *string                `json:"parent_content_id"`
	CreatedAt       string                 `json:"created_at"`
}

// GroupMembership represents a user's group membership from Supabase
type GroupMembership struct {
	GroupID string `json:"group_id"`
	Group   *Group `json:"groups,omitempty"`
}

// Group represents a group from Supabase
type Group struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// FileTypeStats holds statistics about file types in a directory
type FileTypeStats struct {
	Extension string // File extension
	Count     int    // Number of files with this extension
	TotalSize int64  // Total size of all files with this extension
}

// FolderHierarchy tracks created folders for parent-child relationships
type FolderHierarchy struct {
	Path      string // Relative path of the folder
	ContentID string // Supabase content ID for this folder
	Parent    string // Relative path of parent folder
}
