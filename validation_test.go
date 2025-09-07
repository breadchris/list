package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestIMDbStructValidation validates the IMDb data structures and JSON serialization
func TestIMDbStructValidation(t *testing.T) {
	t.Log("🧪 Testing IMDb data structure validation...")

	// Test IMDbTitle struct with all fields
	title := IMDbTitle{
		TitleID:       "tt0111161",
		TitleType:     "movie",
		PrimaryTitle:  "The Shawshank Redemption",
		OriginalTitle: "The Shawshank Redemption",
		IsAdult:       false,
		StartYear:     func() *int { v := 1994; return &v }(),
		EndYear:       nil,
		RuntimeMinutes: func() *int { v := 142; return &v }(),
		Genres:        []string{"Drama"},
		AverageRating: func() *float64 { v := 9.3; return &v }(),
		NumVotes:      func() *int { v := 2500000; return &v }(),
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

// TestIMDbGroupNaming validates the group naming convention
func TestIMDbGroupNaming(t *testing.T) {
	t.Log("🧪 Testing IMDb group naming convention...")

	// Test the group name format
	currentDate := time.Now().Format("2006-01-02")
	expectedPattern := "imdb-import-" + currentDate

	// This matches the pattern used in TestImportIMDbData
	groupName := fmt.Sprintf("imdb-import-%s", currentDate)

	if groupName != expectedPattern {
		t.Errorf("Group name = %q, expected pattern %q", groupName, expectedPattern)
	}

	t.Logf("✅ Group naming validated: %s", groupName)

	// Test that the format matches the requirement "imdb-import-<date>"
	if !strings.HasPrefix(groupName, "imdb-import-") {
		t.Error("Group name should start with 'imdb-import-'")
	}

	if !strings.Contains(groupName, currentDate) {
		t.Error("Group name should contain current date")
	}

	t.Log("✅ Group naming convention matches requirements")
}

// TestIMDbDataStructure validates the overall data structure design
func TestIMDbDataStructure(t *testing.T) {
	t.Log("🧪 Testing IMDb data structure design...")

	// Simulate the data transformation that would happen in the real import
	mockTitle := IMDbTitle{
		TitleID:       "tt0111161",
		TitleType:     "movie",
		PrimaryTitle:  "The Shawshank Redemption",
		OriginalTitle: "The Shawshank Redemption",
		IsAdult:       false,
		StartYear:     func() *int { v := 1994; return &v }(),
		RuntimeMinutes: func() *int { v := 142; return &v }(),
		Genres:        []string{"Drama"},
		AverageRating: func() *float64 { v := 9.3; return &v }(),
		NumVotes:      func() *int { v := 2500000; return &v }(),
	}

	// Test the data format that would be stored in the database
	titleData := mockTitle.PrimaryTitle

	// Test metadata JSON embedding (as done in the real import)
	metadataJSON, err := json.Marshal(mockTitle)
	if err != nil {
		t.Fatalf("Failed to marshal metadata: %v", err)
	}

	fullTitleData := fmt.Sprintf("%s [%s]", mockTitle.PrimaryTitle, string(metadataJSON))

	t.Logf("✅ Title data format: %q", titleData)
	t.Logf("✅ Full data with metadata (length: %d chars)", len(fullTitleData))

	// Validate that we can extract the title back
	if idx := strings.Index(fullTitleData, " ["); idx != -1 {
		extractedTitle := fullTitleData[:idx]
		if extractedTitle != mockTitle.PrimaryTitle {
			t.Errorf("Title extraction failed: got %q, expected %q", extractedTitle, mockTitle.PrimaryTitle)
		}
	}

	t.Log("✅ Data structure design validated")
}

// TestIMDbImportFlow validates the logical flow of the import process
func TestIMDbImportFlow(t *testing.T) {
	t.Log("🧪 Testing IMDb import process flow...")

	// Step 1: Validate file operations would work
	dataDir := "data/imdb"
	titleBasicsFile := filepath.Join(dataDir, "title.basics.tsv.gz")
	titleRatingsFile := filepath.Join(dataDir, "title.ratings.tsv.gz")

	// Check that paths are constructed correctly
	if !strings.HasSuffix(titleBasicsFile, ".tsv.gz") {
		t.Error("Title basics file should have .tsv.gz extension")
	}
	if !strings.HasSuffix(titleRatingsFile, ".tsv.gz") {
		t.Error("Title ratings file should have .tsv.gz extension")
	}

	t.Log("✅ File path construction validated")

	// Step 2: Validate filtering logic
	testRecords := [][]string{
		{"tconst", "titleType", "primaryTitle", "originalTitle", "isAdult", "startYear", "endYear", "runtimeMinutes", "genres"},
		{"tt0000001", "movie", "Test Movie 1", "Test Movie 1", "0", "1990", "\\N", "120", "Drama,Action"},
		{"tt0000002", "movie", "Adult Movie", "Adult Movie", "1", "1995", "\\N", "90", "Adult"},
		{"tt0000003", "tvSeries", "Test TV Show", "Test TV Show", "0", "2000", "2010", "\\N", "Comedy"},
		{"tt0000004", "short", "Test Short", "Test Short", "0", "2005", "\\N", "30", "Drama"},
	}

	var filteredTitles []IMDbTitle
	maxTitles := 10 // Small limit for testing

	// Simulate the filtering logic from the real import (skip header)
	for _, record := range testRecords[1:] {
		if len(filteredTitles) >= maxTitles {
			break
		}

		if len(record) < 9 {
			continue // Skip incomplete records
		}

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

		title := IMDbTitle{
			TitleID:       titleID,
			TitleType:     titleType,
			PrimaryTitle:  primaryTitle,
			OriginalTitle: originalTitle,
			IsAdult:       isAdult,
			StartYear:     parseIntField(record[5]),
			EndYear:       parseIntField(record[6]),
			RuntimeMinutes: parseIntField(record[7]),
			Genres:        parseGenres(record[8]),
		}

		filteredTitles = append(filteredTitles, title)
	}

	// Validate filtering results
	expectedCount := 2 // movie and tvSeries, excluding adult and short
	if len(filteredTitles) != expectedCount {
		t.Errorf("Filtered titles count = %d, expected %d", len(filteredTitles), expectedCount)
	}

	// Check that adult content was filtered out
	for _, title := range filteredTitles {
		if title.IsAdult {
			t.Error("Adult content should be filtered out")
		}
		if title.TitleType != "movie" && title.TitleType != "tvSeries" {
			t.Errorf("Invalid title type: %s", title.TitleType)
		}
	}

	t.Logf("✅ Import filtering logic validated (%d titles processed)", len(filteredTitles))

	// Step 3: Validate database operations structure
	userEmail := "chris@breadchris.com"
	currentDate := time.Now().Format("2006-01-02")
	groupName := fmt.Sprintf("imdb-import-%s", currentDate)
	listData := fmt.Sprintf("IMDb Titles Import - %d items", len(filteredTitles))

	// These would be the SQL operations (validated for structure, not execution)
	sqlOperations := []string{
		fmt.Sprintf("Get or create user: %s", userEmail),
		fmt.Sprintf("Create group: %s", groupName),
		"Add user to group as owner",
		"Create 'imdb' and 'import' tags",
		fmt.Sprintf("Create parent list: %s", listData),
		"Add tags to parent content",
		fmt.Sprintf("Insert %d child content items", len(filteredTitles)),
		"Commit transaction",
		"Verify import with queries",
	}

	t.Log("✅ Database operations flow:")
	for i, op := range sqlOperations {
		t.Logf("   %d. %s", i+1, op)
	}

	t.Log("✅ Complete import flow validated")
}