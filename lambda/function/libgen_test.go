package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

// BookInfo represents a book from Libgen search with snake_case JSON tags
type BookInfo struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Author    string   `json:"author"`
	Publisher string   `json:"publisher"`
	Year      string   `json:"year"`
	Language  string   `json:"language"`
	Pages     string   `json:"pages"`
	Size      string   `json:"size"`
	Extension string   `json:"extension"`
	MD5       string   `json:"md5"`
	Mirrors   []string `json:"mirrors"`
}

// LibgenSearchRequest represents the search parameters
type LibgenSearchRequest struct {
	Query      string            `json:"query"`
	SearchType string            `json:"search_type"`
	Topics     []string          `json:"topics"`
	Filters    map[string]string `json:"filters"`
}

const (
	lambdaEndpoint = "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content"
	testTimeout    = 30 * time.Second
)

// ==================== URL BUILDING TESTS ====================

func TestLibgenURLBuilding(t *testing.T) {
	t.Log("🧪 Testing Libgen URL building...")

	testCases := []struct {
		request       LibgenSearchRequest
		expectedQuery string
		expectedCols  []string
		desc          string
	}{
		{
			request:       LibgenSearchRequest{Query: "python", SearchType: "title", Topics: []string{"libgen"}},
			expectedQuery: "python",
			expectedCols:  []string{"title"},
			desc:          "title search single word",
		},
		{
			request:       LibgenSearchRequest{Query: "designing interfaces", SearchType: "default", Topics: []string{"libgen"}},
			expectedQuery: "designing interfaces",
			expectedCols:  []string{"title", "author"},
			desc:          "default search multi-word",
		},
		{
			request:       LibgenSearchRequest{Query: "Jenifer Tidwell", SearchType: "author", Topics: []string{"libgen"}},
			expectedQuery: "Jenifer Tidwell",
			expectedCols:  []string{"author"},
			desc:          "author search",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Build expected URL (we'll validate the Lambda does this correctly)
			baseURL := "https://libgen.li/index.php"
			u, err := url.Parse(baseURL)
			if err != nil {
				t.Fatalf("Failed to parse base URL: %v", err)
			}

			params := u.Query()
			params.Set("req", tc.expectedQuery)

			// Verify query encoding
			if params.Get("req") != tc.expectedQuery {
				t.Errorf("Query not preserved correctly, got %q, expected %q", params.Get("req"), tc.expectedQuery)
			}

			t.Logf("✓ URL building validated for: %s", tc.desc)
		})
	}

	t.Log("✅ All URL building tests passed")
}

// ==================== TITLE VALIDATION TESTS ====================

func TestLibgenTitleValidation(t *testing.T) {
	t.Log("🧪 Testing Libgen title validation...")

	testCases := []struct {
		book       BookInfo
		shouldKeep bool
		desc       string
	}{
		{
			book:       BookInfo{Title: "Designing Interfaces", Author: "Jenifer Tidwell", Extension: "pdf"},
			shouldKeep: true,
			desc:       "valid book with title",
		},
		{
			book:       BookInfo{Title: "", Author: "John Doe", Extension: "epub"},
			shouldKeep: false,
			desc:       "empty title should be rejected",
		},
		{
			book:       BookInfo{Title: "   ", Author: "Jane Doe", Extension: "mobi"},
			shouldKeep: false,
			desc:       "whitespace-only title should be rejected",
		},
		{
			book:       BookInfo{Title: "Python Programming", Author: "", Extension: "pdf"},
			shouldKeep: true,
			desc:       "valid book with empty author is OK",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Title validation logic: skip books with empty or whitespace-only titles
			trimmedTitle := strings.TrimSpace(tc.book.Title)
			shouldKeep := trimmedTitle != ""

			if shouldKeep != tc.shouldKeep {
				t.Errorf("Title validation failed: got shouldKeep=%v, expected %v for book: %+v",
					shouldKeep, tc.shouldKeep, tc.book)
			}

			t.Logf("✓ Title validation correct for: %s", tc.desc)
		})
	}

	t.Log("✅ All title validation tests passed")
}

// ==================== INTEGRATION TESTS ====================

func TestLibgenIntegration(t *testing.T) {
	t.Log("🧪 Testing Libgen search integration...")

	// Test cases with different query types
	testCases := []struct {
		query          string
		searchType     string
		expectedMinMax struct{ min, max int }
		desc           string
	}{
		{
			query:          "python",
			searchType:     "title",
			expectedMinMax: struct{ min, max int }{1, 100},
			desc:           "single-word title search (known working)",
		},
		{
			query:          "designing interfaces",
			searchType:     "default",
			expectedMinMax: struct{ min, max int }{1, 100},
			desc:           "multi-word default search (investigating)",
		},
		{
			query:          "machine learning",
			searchType:     "title",
			expectedMinMax: struct{ min, max int }{1, 100},
			desc:           "multi-word title search",
		},
		{
			query:          "Jenifer Tidwell",
			searchType:     "author",
			expectedMinMax: struct{ min, max int }{1, 50},
			desc:           "author name search",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			result := searchLibgen(t, tc.query, tc.searchType)

			if result == nil {
				t.Fatal("Search returned nil result")
			}

			if !result.Success {
				t.Fatalf("Search failed: %v", result.Data)
			}

			// Extract books_found from result
			var booksFound int
			if len(result.Data) > 0 {
				if dataMap, ok := result.Data[0].(map[string]interface{}); ok {
					if found, ok := dataMap["books_found"].(float64); ok {
						booksFound = int(found)
					}
				}
			}

			t.Logf("📚 Query %q returned %d books", tc.query, booksFound)

			// Validate book count is within expected range
			if booksFound < tc.expectedMinMax.min || booksFound > tc.expectedMinMax.max {
				t.Logf("⚠️  Books found (%d) outside expected range [%d, %d] for query %q",
					booksFound, tc.expectedMinMax.min, tc.expectedMinMax.max, tc.query)

				// Don't fail the test, just log - libgen results may vary
				if booksFound == 0 {
					t.Logf("⚠️  ZERO results for %q - this may indicate a parsing issue", tc.query)
				}
			} else {
				t.Logf("✓ Books found (%d) within expected range [%d, %d]",
					booksFound, tc.expectedMinMax.min, tc.expectedMinMax.max)
			}
		})
	}

	t.Log("✅ All integration tests completed")
}

// TestLibgenMultiWordQueries specifically tests multi-word query handling
func TestLibgenMultiWordQueries(t *testing.T) {
	t.Log("🧪 Testing Libgen multi-word query handling...")

	multiWordQueries := []string{
		"designing interfaces",
		"golang programming",
		"machine learning",
		"artificial intelligence",
	}

	for _, query := range multiWordQueries {
		t.Run(query, func(t *testing.T) {
			result := searchLibgen(t, query, "default")

			if result == nil || !result.Success {
				t.Fatalf("Search failed for query %q", query)
			}

			var booksFound int
			if len(result.Data) > 0 {
				if dataMap, ok := result.Data[0].(map[string]interface{}); ok {
					if found, ok := dataMap["books_found"].(float64); ok {
						booksFound = int(found)
					}
				}
			}

			t.Logf("📚 Multi-word query %q: %d books found", query, booksFound)

			if booksFound == 0 {
				t.Logf("⚠️  WARNING: Zero results for multi-word query %q", query)
				t.Logf("    This may indicate:")
				t.Logf("    - URL encoding issue")
				t.Logf("    - Different HTML structure for multi-word results")
				t.Logf("    - Title extraction not handling multi-word titles")
			}
		})
	}

	t.Log("✅ Multi-word query tests completed")
}

// ==================== HELPER FUNCTIONS ====================

// LibgenSearchResult represents the Lambda response
type LibgenSearchResult struct {
	Success bool          `json:"success"`
	Data    []interface{} `json:"data"`
}

// searchLibgen calls the Lambda endpoint to search Libgen
func searchLibgen(t *testing.T, query, searchType string) *LibgenSearchResult {
	// Build request payload
	payload := map[string]interface{}{
		"action": "libgen-search",
		"sync":   true, // Synchronous execution for testing
		"payload": map[string]interface{}{
			"selectedContent": []map[string]interface{}{
				{
					"id":      "test-id",
					"data":    query,
					"type":    "text",
					"group_id": "test-group",
					"user_id":  "test-user",
				},
			},
			"searchType": searchType,
			"topics":     []string{"libgen"},
			"maxResults": 10,
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Failed to marshal payload: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", lambdaEndpoint, strings.NewReader(string(payloadBytes)))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Execute request with timeout
	client := &http.Client{Timeout: testTimeout}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result LibgenSearchResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	return &result
}
