package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const (
	libgenMirror = "https://libgen.li"
	searchPath   = "/index.php"
	userAgent    = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
)

// handleLibgenSearch processes a Libgen search request
func handleLibgenSearch(params json.RawMessage) (LibgenSearchResponse, error) {
	var req LibgenSearchRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return LibgenSearchResponse{}, fmt.Errorf("invalid libgen search request: %w", err)
	}

	if req.Query == "" {
		return LibgenSearchResponse{}, fmt.Errorf("query is required")
	}

	// Set defaults
	if req.SearchType == "" {
		req.SearchType = "default"
	}
	if len(req.Topics) == 0 {
		req.Topics = []string{"libgen"}
	}

	// Perform search
	books, err := searchLibgen(req)
	if err != nil {
		return LibgenSearchResponse{}, fmt.Errorf("search failed: %w", err)
	}

	return LibgenSearchResponse{
		Books: books,
		Query: req.Query,
	}, nil
}

// searchLibgen performs the HTTP request and parses results
func searchLibgen(req LibgenSearchRequest) ([]BookInfo, error) {
	// Build search URL
	searchURL, err := buildSearchURL(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build search URL: %w", err)
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Create request
	httpReq, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("User-Agent", userAgent)

	// Execute request
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d %s", resp.StatusCode, resp.Status)
	}

	// Parse HTML
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Extract books from table
	books := extractBooks(doc, req)

	return books, nil
}

// buildSearchURL constructs the search URL with query parameters
func buildSearchURL(req LibgenSearchRequest) (string, error) {
	baseURL, err := url.Parse(libgenMirror + searchPath)
	if err != nil {
		return "", err
	}

	params := url.Values{}
	params.Set("req", req.Query)
	params.Set("res", "100") // Results per page

	// Set search columns based on search type
	switch req.SearchType {
	case "title":
		params.Add("columns[]", "title")
	case "author":
		params.Add("columns[]", "author")
	default:
		// Default search includes multiple columns
		params.Add("columns[]", "title")
		params.Add("columns[]", "author")
	}

	// Add objects to search
	params.Add("objects[]", "f") // files
	params.Add("objects[]", "e") // editions
	params.Add("objects[]", "s") // series
	params.Add("objects[]", "a") // authors
	params.Add("objects[]", "p") // publishers
	params.Add("objects[]", "w") // works

	// Add topics
	for _, topic := range req.Topics {
		params.Add("topics[]", topic)
	}

	// Add filters if provided
	if req.Filters != nil {
		for key, value := range req.Filters {
			params.Set(key, value)
		}
	}

	params.Set("filesuns", "all")

	baseURL.RawQuery = params.Encode()
	return baseURL.String(), nil
}

// extractBooks parses the HTML table and extracts book information
func extractBooks(doc *goquery.Document, req LibgenSearchRequest) []BookInfo {
	var books []BookInfo

	// Remove all <i> tags first (they interfere with parsing)
	doc.Find("i").Remove()

	// Find the results table
	table := doc.Find("table#tablelibgen")
	if table.Length() == 0 {
		return books
	}

	// Iterate through table rows
	table.Find("tbody tr").Each(func(i int, row *goquery.Selection) {
		cells := row.Find("td")
		if cells.Length() < 9 {
			return // Skip malformed rows
		}

		// Extract book data from cells
		book := BookInfo{
			ID:        strings.TrimSpace(cells.Eq(0).Text()),
			Author:    strings.TrimSpace(cells.Eq(1).Text()),
			Title:     strings.TrimSpace(cells.Eq(2).Text()),
			Publisher: strings.TrimSpace(cells.Eq(3).Text()),
			Year:      strings.TrimSpace(cells.Eq(4).Text()),
			Pages:     strings.TrimSpace(cells.Eq(5).Text()),
			Language:  strings.TrimSpace(cells.Eq(6).Text()),
			Size:      strings.TrimSpace(cells.Eq(7).Text()),
			Extension: strings.TrimSpace(cells.Eq(8).Text()),
		}

		// Extract mirror links
		if cells.Length() > 9 {
			mirrors := extractMirrors(cells.Eq(9))
			book.Mirrors = mirrors
		}

		// Extract MD5 from first cell link if available
		if link, exists := cells.Eq(0).Find("a").Attr("href"); exists {
			if strings.Contains(link, "/book/index.php?md5=") {
				parts := strings.Split(link, "md5=")
				if len(parts) > 1 {
					book.MD5 = strings.TrimSpace(parts[1])
				}
			}
		}

		// Apply filters if specified
		if matchesFilters(book, req.Filters) {
			books = append(books, book)
		}
	})

	return books
}

// extractMirrors extracts and normalizes mirror download links
func extractMirrors(cell *goquery.Selection) []string {
	var mirrors []string

	cell.Find("a").Each(func(i int, link *goquery.Selection) {
		href, exists := link.Attr("href")
		if !exists {
			return
		}

		// Convert relative URLs to absolute
		if strings.HasPrefix(href, "/") {
			href = libgenMirror + href
		}

		mirrors = append(mirrors, href)
	})

	// Pad to 4 mirrors (matching Python implementation)
	for len(mirrors) < 4 {
		mirrors = append(mirrors, "")
	}

	return mirrors
}

// matchesFilters checks if a book matches the specified filters
func matchesFilters(book BookInfo, filters map[string]string) bool {
	if filters == nil || len(filters) == 0 {
		return true
	}

	for key, value := range filters {
		switch key {
		case "year":
			if book.Year != value {
				return false
			}
		case "extension":
			if !strings.EqualFold(book.Extension, value) {
				return false
			}
		case "language":
			if !strings.EqualFold(book.Language, value) {
				return false
			}
		}
	}

	return true
}
