package main

import (
	"compress/gzip"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// IMDbTitle represents a title from the IMDb dataset with snake_case JSON tags
type IMDbTitle struct {
	TitleID        string   `json:"title_id"`        // tconst
	TitleType      string   `json:"title_type"`      // movie, tvseries, etc
	PrimaryTitle   string   `json:"primary_title"`   // main title
	OriginalTitle  string   `json:"original_title"`  // original language title
	IsAdult        bool     `json:"is_adult"`        // adult content flag
	StartYear      *int     `json:"start_year"`      // release year
	EndYear        *int     `json:"end_year"`        // end year for TV series
	RuntimeMinutes *int     `json:"runtime_minutes"` // duration in minutes
	Genres         []string `json:"genres"`          // genre list
	AverageRating  *float64 `json:"average_rating"`  // from ratings file
	NumVotes       *int     `json:"num_votes"`       // vote count from ratings
}

// Helper functions for parsing IMDb TSV data

// parseIntField converts string to *int, handling '\N' null values
func parseIntField(s string) *int {
	if s == "" || s == "\\N" {
		return nil
	}
	if val, err := strconv.Atoi(s); err == nil {
		return &val
	}
	return nil
}

// parseFloatField converts string to *float64, handling '\N' null values
func parseFloatField(s string) *float64 {
	if s == "" || s == "\\N" {
		return nil
	}
	if val, err := strconv.ParseFloat(s, 64); err == nil {
		return &val
	}
	return nil
}

// parseGenres splits genre string into slice, handling '\N' null values
func parseGenres(s string) []string {
	if s == "" || s == "\\N" {
		return []string{}
	}
	return strings.Split(s, ",")
}

// downloadIMDbFile downloads an IMDb dataset file if it doesn't exist (with caching)
func downloadIMDbFile(filePath, url string) error {
	// Check if file already exists (CACHE HIT)
	if _, err := os.Stat(filePath); err == nil {
		return nil // File already exists, no download needed
	}

	// Create the directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %v", err)
	}

	// Download the file
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("failed to download file: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	// Create the file
	out, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file: %v", err)
	}
	defer out.Close()

	// Copy the data
	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}

	return nil
}

// parseIMDbTSV parses a gzipped TSV file and returns the records
func parseIMDbTSV(filePath string) ([][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %v", err)
	}
	defer file.Close()

	// Create gzip reader
	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %v", err)
	}
	defer gzReader.Close()

	// Create CSV reader for TSV (Tab-Separated Values)
	csvReader := csv.NewReader(gzReader)
	csvReader.Comma = '\t'          // Tab delimiter
	csvReader.LazyQuotes = true     // Allow lazy quotes
	csvReader.FieldsPerRecord = -1  // Allow variable number of fields

	// Read all records
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %v", err)
	}

	return records, nil
}

// ==================== VALIDATION TESTS ====================

// TestIMDbStructValidation validates the IMDb data structures and JSON serialization
func TestIMDbStructValidation(t *testing.T) {
	t.Log("🧪 Testing IMDb data structure validation...")

	// Test IMDbTitle struct with all fields
	title := IMDbTitle{
		TitleID:        "tt0111161",
		TitleType:      "movie",
		PrimaryTitle:   "The Shawshank Redemption",
		OriginalTitle:  "The Shawshank Redemption",
		IsAdult:        false,
		StartYear:      func() *int { v := 1994; return &v }(),
		EndYear:        nil,
		RuntimeMinutes: func() *int { v := 142; return &v }(),
		Genres:         []string{"Drama"},
		AverageRating:  func() *float64 { v := 9.3; return &v }(),
		NumVotes:       func() *int { v := 2500000; return &v }(),
	}

	// Test JSON serialization with snake_case
	jsonData, err := json.MarshalIndent(title, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal IMDbTitle to JSON: %v", err)
	}

	t.Log("✅ IMDbTitle JSON serialization (snake_case):")
	t.Log(string(jsonData))

	// Verify snake_case fields are present
	jsonStr := string(jsonData)
	requiredFields := []string{
		"title_id", "title_type", "primary_title", "original_title",
		"is_adult", "start_year", "runtime_minutes", "genres",
		"average_rating", "num_votes",
	}

	for _, field := range requiredFields {
		if !strings.Contains(jsonStr, fmt.Sprintf(`"%s"`, field)) {
			t.Errorf("Missing snake_case field: %s", field)
		}
	}

	t.Log("✅ All snake_case JSON fields validated")

	// Test null field handling
	titleWithNulls := IMDbTitle{
		TitleID:      "tt1234567",
		TitleType:    "movie",
		PrimaryTitle: "Test Movie",
		StartYear:    nil, // null field
		EndYear:      nil, // null field
		Genres:       []string{},
	}

	nullJsonData, err := json.Marshal(titleWithNulls)
	if err != nil {
		t.Fatalf("Failed to marshal title with nulls: %v", err)
	}

	t.Logf("✅ Null field handling: %s", string(nullJsonData))
}

// TestIMDbParsingFunctions validates the parsing helper functions
func TestIMDbParsingFunctions(t *testing.T) {
	t.Log("🧪 Testing IMDb parsing functions...")

	// Test parseIntField
	testCases := []struct {
		input    string
		expected *int
		desc     string
	}{
		{"1994", func() *int { v := 1994; return &v }(), "valid integer"},
		{"\\N", nil, "null value \\N"},
		{"", nil, "empty string"},
		{"invalid", nil, "invalid integer"},
	}

	for _, tc := range testCases {
		result := parseIntField(tc.input)
		if tc.expected == nil {
			if result != nil {
				t.Errorf("parseIntField(%q) = %v, expected nil (%s)", tc.input, result, tc.desc)
			}
		} else {
			if result == nil || *result != *tc.expected {
				t.Errorf("parseIntField(%q) = %v, expected %v (%s)", tc.input, result, tc.expected, tc.desc)
			}
		}
	}

	// Test parseFloatField
	floatTestCases := []struct {
		input    string
		expected *float64
		desc     string
	}{
		{"9.3", func() *float64 { v := 9.3; return &v }(), "valid float"},
		{"\\N", nil, "null value \\N"},
		{"", nil, "empty string"},
	}

	for _, tc := range floatTestCases {
		result := parseFloatField(tc.input)
		if tc.expected == nil {
			if result != nil {
				t.Errorf("parseFloatField(%q) = %v, expected nil (%s)", tc.input, result, tc.desc)
			}
		} else {
			if result == nil || *result != *tc.expected {
				t.Errorf("parseFloatField(%q) = %v, expected %v (%s)", tc.input, result, tc.expected, tc.desc)
			}
		}
	}

	// Test parseGenres
	genreTestCases := []struct {
		input    string
		expected []string
		desc     string
	}{
		{"Drama,Crime,Thriller", []string{"Drama", "Crime", "Thriller"}, "multiple genres"},
		{"Action", []string{"Action"}, "single genre"},
		{"\\N", []string{}, "null value"},
		{"", []string{}, "empty string"},
	}

	for _, tc := range genreTestCases {
		result := parseGenres(tc.input)
		if len(result) != len(tc.expected) {
			t.Errorf("parseGenres(%q) length = %d, expected %d (%s)", tc.input, len(result), len(tc.expected), tc.desc)
			continue
		}
		for i, genre := range tc.expected {
			if i >= len(result) || result[i] != genre {
				t.Errorf("parseGenres(%q) = %v, expected %v (%s)", tc.input, result, tc.expected, tc.desc)
				break
			}
		}
	}

	t.Log("✅ All parsing functions validated")
}

// ==================== SHARED IMPORT LOGIC ====================

// IMDbImportResult contains the results of an IMDb import operation
type IMDbImportResult struct {
	UserID          string
	GroupID         string
	GroupName       string
	ParentContentID string
	ImdbTagID       string
	ImportTagID     string
	InsertedCount   int
	TotalTitles     int
	ContentCreated  int
	TagsCreated     int
}

// imdbImport performs the core IMDb import logic within a transaction
// This function is designed for both testing (with rollback) and production (with commit)
// The caller is responsible for transaction lifecycle management
func imdbImport(tx *sql.Tx, titles []IMDbTitle, userEmail string) (*IMDbImportResult, error) {
	result := &IMDbImportResult{
		TotalTitles: len(titles),
	}

	// Get or create user
	var userID string
	err := tx.QueryRow(`
		UPDATE users
		SET username = $1
		WHERE username IS NULL
		RETURNING id
	`, userEmail).Scan(&userID)

	if err == sql.ErrNoRows {
		err = tx.QueryRow(`
			SELECT id FROM users WHERE username = $1
		`, userEmail).Scan(&userID)

		if err == sql.ErrNoRows {
			err = tx.QueryRow(`
				INSERT INTO users (id, username, created_at)
				VALUES (gen_random_uuid(), $1, NOW())
				RETURNING id
			`, userEmail).Scan(&userID)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get or create user: %w", err)
	}
	result.UserID = userID

	// Get or create "upload" group (reused across all uploads)
	groupName := "upload"
	var groupID string

	// Try to get existing "upload" group
	err = tx.QueryRow(`
		SELECT id FROM groups WHERE name = $1 AND created_by = $2
	`, groupName, userID).Scan(&groupID)

	if err == sql.ErrNoRows {
		// Create "upload" group if it doesn't exist
		err = tx.QueryRow(`
			INSERT INTO groups (id, name, created_by, created_at, join_code)
			VALUES (gen_random_uuid(), $1, $2, NOW(), substr(md5(random()::text), 1, 8))
			RETURNING id
		`, groupName, userID).Scan(&groupID)
		if err != nil {
			return nil, fmt.Errorf("failed to create group: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to query group: %w", err)
	}

	result.GroupID = groupID
	result.GroupName = groupName

	// Add user to group as owner (if not already a member)
	_, err = tx.Exec(`
		INSERT INTO group_memberships (id, user_id, group_id, role, created_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())
		ON CONFLICT (user_id, group_id) DO NOTHING
	`, userID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to add user to group: %w", err)
	}

	// Create tags using upsert pattern to avoid transaction abort on duplicates
	var imdbTagID, importTagID string

	// Get or create imdb tag (upsert pattern)
	err = tx.QueryRow(`
		SELECT id FROM tags WHERE name = 'imdb' AND user_id = $1
	`, userID).Scan(&imdbTagID)
	if err == sql.ErrNoRows {
		err = tx.QueryRow(`
			INSERT INTO tags (id, name, user_id, created_at)
			VALUES (gen_random_uuid(), 'imdb', $1, NOW())
			RETURNING id
		`, userID).Scan(&imdbTagID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create or get imdb tag: %w", err)
	}
	result.ImdbTagID = imdbTagID

	// Get or create import tag (upsert pattern)
	err = tx.QueryRow(`
		SELECT id FROM tags WHERE name = 'import' AND user_id = $1
	`, userID).Scan(&importTagID)
	if err == sql.ErrNoRows {
		err = tx.QueryRow(`
			INSERT INTO tags (id, name, user_id, created_at)
			VALUES (gen_random_uuid(), 'import', $1, NOW())
			RETURNING id
		`, userID).Scan(&importTagID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create or get import tag: %w", err)
	}
	result.ImportTagID = importTagID

	// Create parent list content
	listData := fmt.Sprintf("IMDb Titles Import - %d items", len(titles))
	var parentContentID string
	err = tx.QueryRow(`
		INSERT INTO content (id, type, data, group_id, user_id, created_at, updated_at)
		VALUES (gen_random_uuid(), 'list', $1, $2, $3, NOW(), NOW())
		RETURNING id
	`, listData, groupID, userID).Scan(&parentContentID)
	if err != nil {
		return nil, fmt.Errorf("failed to create parent list content: %w", err)
	}
	result.ParentContentID = parentContentID

	// Add tags to parent content
	_, err = tx.Exec(`
		INSERT INTO content_tags (content_id, tag_id, created_at)
		VALUES ($1, $2, NOW()), ($1, $3, NOW())
	`, parentContentID, imdbTagID, importTagID)
	if err != nil {
		return nil, fmt.Errorf("failed to add tags to parent content: %w", err)
	}

	// Insert all titles as child content items using PostgreSQL COPY protocol
	insertedCount := 0
	now := time.Now()

	// Use COPY protocol for bulk insert (10-20x faster than individual INSERTs)
	stmt, err := tx.Prepare(pq.CopyIn("content",
		"id", "type", "data", "metadata", "group_id", "user_id", "parent_content_id", "created_at", "updated_at"))
	if err != nil {
		return nil, fmt.Errorf("failed to prepare COPY statement: %w", err)
	}
	defer stmt.Close()

	for _, title := range titles {
		// Use primary title as the main data field
		titleData := title.PrimaryTitle

		// Marshal IMDb metadata to JSON for the metadata column
		metadataJSON, err := json.Marshal(title)
		if err != nil {
			// Skip if we can't marshal metadata
			continue
		}

		// Queue row for COPY (doesn't execute yet)
		// Note: COPY protocol requires JSON as string, not bytes
		_, err = stmt.Exec(
			uuid.New().String(),
			"movie",
			titleData,
			string(metadataJSON),
			groupID,
			userID,
			parentContentID,
			now,
			now,
		)
		if err != nil {
			// Continue on error, track failed inserts
			continue
		}
		insertedCount++
	}

	// Execute the bulk COPY
	_, err = stmt.Exec()
	if err != nil {
		return nil, fmt.Errorf("failed to execute COPY: %w", err)
	}

	result.InsertedCount = insertedCount
	result.ContentCreated = insertedCount + 1 // +1 for parent list
	result.TagsCreated = 2                    // imdb and import tags
	return result, nil
}

// loadAndProcessIMDbData downloads, parses, and processes IMDb datasets
// Returns a slice of IMDbTitle structs ready for import
func loadAndProcessIMDbData(maxTitles int) ([]IMDbTitle, error) {
	// Define file paths and URLs
	dataDir := "data/imdb"
	titleBasicsFile := filepath.Join(dataDir, "title.basics.tsv.gz")
	titleRatingsFile := filepath.Join(dataDir, "title.ratings.tsv.gz")

	titleBasicsURL := "https://datasets.imdbws.com/title.basics.tsv.gz"
	titleRatingsURL := "https://datasets.imdbws.com/title.ratings.tsv.gz"

	// Download files if they don't exist (with caching)
	if err := downloadIMDbFile(titleBasicsFile, titleBasicsURL); err != nil {
		return nil, fmt.Errorf("failed to download title.basics.tsv.gz: %w", err)
	}

	if err := downloadIMDbFile(titleRatingsFile, titleRatingsURL); err != nil {
		return nil, fmt.Errorf("failed to download title.ratings.tsv.gz: %w", err)
	}

	// Parse title.basics.tsv.gz
	titleRecords, err := parseIMDbTSV(titleBasicsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to parse title.basics.tsv.gz: %w", err)
	}

	if len(titleRecords) == 0 {
		return nil, fmt.Errorf("no records found in title.basics.tsv.gz")
	}

	// Parse title.ratings.tsv.gz
	ratingRecords, err := parseIMDbTSV(titleRatingsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to parse title.ratings.tsv.gz: %w", err)
	}

	// Build ratings map for fast lookup
	ratings := make(map[string]struct {
		averageRating *float64
		numVotes      *int
	})

	// Skip header (first row) and process ratings
	for _, record := range ratingRecords[1:] {
		if len(record) >= 3 {
			titleID := record[0]
			ratings[titleID] = struct {
				averageRating *float64
				numVotes      *int
			}{
				averageRating: parseFloatField(record[1]),
				numVotes:      parseIntField(record[2]),
			}
		}
	}

	// Process title records
	var titles []IMDbTitle

	// Skip header (first row) and process titles
	for _, record := range titleRecords[1:] {
		// Stop if we've reached the limit (0 = no limit)
		if maxTitles > 0 && len(titles) >= maxTitles {
			break
		}

		if len(record) < 9 {
			continue // Skip incomplete records
		}

		// Parse basic title data
		titleID := record[0]
		titleType := record[1]
		primaryTitle := record[2]
		originalTitle := record[3]
		isAdult := record[4] == "1"

		// Skip adult content
		if isAdult {
			continue
		}

		// Filter for movies and TV series only
		if titleType != "movie" && titleType != "tvSeries" {
			continue
		}

		// Create IMDbTitle struct
		title := IMDbTitle{
			TitleID:        titleID,
			TitleType:      titleType,
			PrimaryTitle:   primaryTitle,
			OriginalTitle:  originalTitle,
			IsAdult:        isAdult,
			StartYear:      parseIntField(record[5]),
			EndYear:        parseIntField(record[6]),
			RuntimeMinutes: parseIntField(record[7]),
			Genres:         parseGenres(record[8]),
		}

		// Add ratings if available
		if rating, exists := ratings[titleID]; exists {
			title.AverageRating = rating.averageRating
			title.NumVotes = rating.numVotes
		}

		titles = append(titles, title)
	}

	if len(titles) == 0 {
		return nil, fmt.Errorf("no suitable titles found for import")
	}

	return titles, nil
}

// ==================== VALIDATION TEST (ROLLBACK) ====================

// TestIMDbIntegration validates the IMDb import logic without persisting data
// This test uses transaction rollback to ensure no data is committed to the database
func TestIMDbIntegration(t *testing.T) {
	t.Log("🎬 Starting IMDb Integration Test (VALIDATION MODE - ROLLBACK)...")

	// Load database configuration
	dbURL, err := LoadDatabaseConfig("data/config.json")
	if err != nil {
		t.Fatalf("Failed to load database config: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}

	t.Log("✅ Connected to database successfully")

	// Load and process IMDb data
	t.Log("📥 Loading IMDb datasets...")
	titles, err := loadAndProcessIMDbData(20) // Limit to 20 for testing
	if err != nil {
		t.Fatalf("Failed to load IMDb data: %v", err)
	}

	t.Logf("✅ Loaded %d IMDb titles for import", len(titles))

	// Start database transaction
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback() // ALWAYS ROLLBACK - validation only

	userEmail := "chris@breadchris.com"

	// Execute import using shared function
	result, err := imdbImport(tx, titles, userEmail)
	if err != nil {
		t.Fatalf("Failed to import IMDb data: %v", err)
	}

	t.Logf("✅ Import completed successfully:")
	t.Logf("   - User ID: %s", result.UserID)
	t.Logf("   - Group ID: %s", result.GroupID)
	t.Logf("   - Group Name: %s", result.GroupName)
	t.Logf("   - Total Titles Processed: %d", result.TotalTitles)
	t.Logf("   - Content Created: %d", result.ContentCreated)
	t.Logf("   - Tags Created: %d", result.TagsCreated)

	// Validate database state
	var groupCount int
	err = tx.QueryRow("SELECT COUNT(*) FROM groups WHERE id = $1", result.GroupID).Scan(&groupCount)
	if err != nil {
		t.Fatalf("Failed to query groups: %v", err)
	}
	if groupCount != 1 {
		t.Fatalf("Expected 1 group, got %d", groupCount)
	}

	var contentCount int
	err = tx.QueryRow("SELECT COUNT(*) FROM content WHERE group_id = $1", result.GroupID).Scan(&contentCount)
	if err != nil {
		t.Fatalf("Failed to query content: %v", err)
	}
	if contentCount != result.ContentCreated {
		t.Fatalf("Expected %d content items, got %d", result.ContentCreated, contentCount)
	}

	var tagCount int
	err = tx.QueryRow("SELECT COUNT(*) FROM tags WHERE user_id = $1 AND (name = 'imdb' OR name = 'import')", result.UserID).Scan(&tagCount)
	if err != nil {
		t.Fatalf("Failed to query tags: %v", err)
	}
	if tagCount != result.TagsCreated {
		t.Fatalf("Expected %d tags, got %d", result.TagsCreated, tagCount)
	}

	t.Log("✅ Database validation passed - all data will be rolled back")
}

// TestIMDbImport_Commit executes the IMDb import and commits the data to the database
// This test is designed to be run as a script to actually populate the database
func TestIMDbImport_Commit(t *testing.T) {
	t.Log("🎬 Starting IMDb Import (EXECUTION MODE - COMMIT)...")

	// Load database configuration
	dbURL, err := LoadDatabaseConfig("data/config.json")
	if err != nil {
		t.Fatalf("Failed to load database config: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}

	t.Log("✅ Connected to database successfully")

	// Load and process IMDb data
	t.Log("📥 Loading IMDb datasets...")
	titles, err := loadAndProcessIMDbData(20) // Limit to 20 for testing
	if err != nil {
		t.Fatalf("Failed to load IMDb data: %v", err)
	}

	t.Logf("✅ Loaded %d IMDb titles for import", len(titles))

	// Start database transaction
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("Failed to start transaction: %v", err)
	}

	userEmail := "chris@breadchris.com"

	// Execute import using shared function
	result, err := imdbImport(tx, titles, userEmail)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to import IMDb data: %v", err)
	}

	// Commit transaction - this is the key difference from validation test
	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	t.Log("✅ Transaction committed successfully - data persisted to database")
	t.Logf("📊 Import Summary:")
	t.Logf("   - User ID: %s", result.UserID)
	t.Logf("   - Group ID: %s", result.GroupID)
	t.Logf("   - Group Name: %s", result.GroupName)
	t.Logf("   - Total Titles Processed: %d", result.TotalTitles)
	t.Logf("   - Content Created: %d", result.ContentCreated)
	t.Logf("   - Tags Created: %d", result.TagsCreated)

	t.Log("🎉 IMDb import completed and committed to database!")
}

// TestIMDbCleanup removes all IMDb test import groups
// Run this to clean up test groups before doing a full import
func TestIMDbCleanup(t *testing.T) {
	t.Log("🧹 Starting IMDb Test Group Cleanup...")

	// Load database configuration
	dbURL, err := LoadDatabaseConfig("data/config.json")
	if err != nil {
		t.Fatalf("Failed to load database config: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}

	t.Log("✅ Connected to database successfully")

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("Failed to start transaction: %v", err)
	}

	// Query groups to be deleted
	rows, err := tx.Query(`
		SELECT id, name, created_at,
		       (SELECT COUNT(*) FROM content WHERE group_id = groups.id) as content_count
		FROM groups
		WHERE name LIKE 'imdb-import%'
		ORDER BY created_at DESC
	`)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to query groups: %v", err)
	}

	type groupInfo struct {
		ID           string
		Name         string
		CreatedAt    string
		ContentCount int
	}

	var groupsToDelete []groupInfo
	for rows.Next() {
		var g groupInfo
		if err := rows.Scan(&g.ID, &g.Name, &g.CreatedAt, &g.ContentCount); err != nil {
			continue
		}
		groupsToDelete = append(groupsToDelete, g)
	}
	rows.Close()

	if len(groupsToDelete) == 0 {
		tx.Rollback()
		t.Log("✅ No IMDb test groups found to clean up")
		return
	}

	t.Logf("📋 Found %d IMDb test groups to delete:", len(groupsToDelete))
	for _, g := range groupsToDelete {
		t.Logf("   - %s (ID: %s, Content: %d items, Created: %s)",
			g.Name, g.ID, g.ContentCount, g.CreatedAt)
	}

	// Delete groups (CASCADE will handle related content, tags, memberships)
	result, err := tx.Exec(`
		DELETE FROM groups
		WHERE name LIKE 'imdb-import%'
	`)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to delete groups: %v", err)
	}

	rowsAffected, _ := result.RowsAffected()
	t.Logf("🗑️  Deleted %d groups", rowsAffected)

	// Commit transaction
	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	t.Log("✅ Cleanup completed successfully!")
}

// TestIMDbImport_Full imports ALL IMDb movies in batches to avoid timeout
// WARNING: This will take 15-30 minutes and import ~800k movies
func TestIMDbImport_Full(t *testing.T) {
	t.Log("🎬 Starting FULL IMDb Import (ALL MOVIES - BATCHED)...")
	t.Log("⚠️  This will take 15-30 minutes to complete")

	// Load database configuration
	dbURL, err := LoadDatabaseConfig("data/config.json")
	if err != nil {
		t.Fatalf("Failed to load database config: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}

	t.Log("✅ Connected to database successfully")

	// Load and process ALL IMDb data (0 = no limit)
	t.Log("📥 Loading IMDb datasets (this will take several minutes)...")
	titles, err := loadAndProcessIMDbData(0)
	if err != nil {
		t.Fatalf("Failed to load IMDb data: %v", err)
	}

	t.Logf("✅ Loaded %d IMDb titles for import", len(titles))

	userEmail := "chris@breadchris.com"
	batchSize := 1000 // Import in batches of 1k
	totalBatches := (len(titles) + batchSize - 1) / batchSize

	t.Logf("📦 Will import in %d batches of up to %d movies each", totalBatches, batchSize)
	t.Log("📁 Using shared \"upload\" group for all batches")

	var finalResult *IMDbImportResult

	// Process in batches
	for batchNum := 0; batchNum < totalBatches; batchNum++ {
		start := batchNum * batchSize
		end := start + batchSize
		if end > len(titles) {
			end = len(titles)
		}

		batchTitles := titles[start:end]
		t.Logf("📦 Batch %d/%d: Importing %d movies (titles %d-%d)...",
			batchNum+1, totalBatches, len(batchTitles), start+1, end)

		// Start new transaction for this batch
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start transaction for batch %d: %v", batchNum+1, err)
		}

		// For first batch, create group and tags
		// For subsequent batches, reuse existing group
		var result *IMDbImportResult
		if batchNum == 0 {
			// First batch - create everything
			result, err = imdbImport(tx, batchTitles, userEmail)
		} else {
			// Subsequent batches - insert into existing group
			result, err = imdbImportBatch(tx, batchTitles, finalResult.UserID,
				finalResult.GroupID, finalResult.ParentContentID)
		}

		if err != nil {
			tx.Rollback()
			t.Fatalf("Failed to import batch %d: %v", batchNum+1, err)
		}

		// Commit this batch
		if err := tx.Commit(); err != nil {
			t.Fatalf("Failed to commit batch %d: %v", batchNum+1, err)
		}

		if batchNum == 0 {
			finalResult = result
		} else {
			// Accumulate totals
			finalResult.TotalTitles += result.TotalTitles
			finalResult.ContentCreated += result.ContentCreated
			finalResult.InsertedCount += result.InsertedCount
		}

		t.Logf("✅ Batch %d/%d completed (%d movies imported)",
			batchNum+1, totalBatches, result.InsertedCount)
	}

	t.Log("✅ All batches committed successfully - all data persisted to database")
	t.Logf("📊 Full Import Summary:")
	t.Logf("   - User ID: %s", finalResult.UserID)
	t.Logf("   - Group ID: %s", finalResult.GroupID)
	t.Logf("   - Group Name: %s", finalResult.GroupName)
	t.Logf("   - Total Titles Processed: %d", finalResult.TotalTitles)
	t.Logf("   - Content Created: %d", finalResult.ContentCreated)
	t.Logf("   - Tags Created: %d", finalResult.TagsCreated)

	t.Log("🎉 Full IMDb import completed and committed to database!")
}

// imdbImportBatch imports a batch of titles into an existing group
// Used for batched imports to avoid transaction timeouts
func imdbImportBatch(tx *sql.Tx, titles []IMDbTitle, userID, groupID, parentContentID string) (*IMDbImportResult, error) {
	result := &IMDbImportResult{
		UserID:          userID,
		GroupID:         groupID,
		ParentContentID: parentContentID,
		TotalTitles:     len(titles),
	}

	// Insert all titles as child content items using PostgreSQL COPY protocol
	insertedCount := 0
	now := time.Now()

	// Use COPY protocol for bulk insert (10-20x faster than individual INSERTs)
	stmt, err := tx.Prepare(pq.CopyIn("content",
		"id", "type", "data", "metadata", "group_id", "user_id", "parent_content_id", "created_at", "updated_at"))
	if err != nil {
		return nil, fmt.Errorf("failed to prepare COPY statement: %w", err)
	}
	defer stmt.Close()

	for _, title := range titles {
		// Use primary title as the main data field
		titleData := title.PrimaryTitle

		// Marshal IMDb metadata to JSON for the metadata column
		metadataJSON, err := json.Marshal(title)
		if err != nil {
			// Skip if we can't marshal metadata
			continue
		}

		// Queue row for COPY (doesn't execute yet)
		// Note: COPY protocol requires JSON as string, not bytes
		_, err = stmt.Exec(
			uuid.New().String(),
			"movie",
			titleData,
			string(metadataJSON),
			groupID,
			userID,
			parentContentID,
			now,
			now,
		)
		if err != nil {
			// Continue on error, track failed inserts
			continue
		}
		insertedCount++
	}

	// Execute the bulk COPY
	_, err = stmt.Exec()
	if err != nil {
		return nil, fmt.Errorf("failed to execute COPY: %w", err)
	}

	result.InsertedCount = insertedCount
	result.ContentCreated = insertedCount
	return result, nil
}
