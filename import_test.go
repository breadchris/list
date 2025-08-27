package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	
	"github.com/alexferrari88/gohn/pkg/gohn"
	_ "github.com/lib/pq"
)

func TestImportOmnivoreLinks(t *testing.T) {
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

	// Read the Omnivore.md file
	omnivoreFilePath := os.ExpandEnv("$HOME/Documents/GitHub/notes/pages/Omnivore.md")
	content, err := os.ReadFile(omnivoreFilePath)
	if err != nil {
		t.Fatalf("Failed to read Omnivore.md: %v", err)
	}

	// Extract URLs using regex
	re := regexp.MustCompile(`site:: \[.*?\]\((.*?)\)`)
	matches := re.FindAllStringSubmatch(string(content), -1)

	var urls []string
	for _, match := range matches {
		if len(match) > 1 {
			urls = append(urls, match[1])
		}
	}

	t.Logf("Found %d URLs to import", len(urls))

	if len(urls) == 0 {
		t.Fatal("No URLs found in Omnivore.md")
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback() // Will be ignored if transaction is committed

	userEmail := "chris@breadchris.com"
	
	// Update existing user to set the username (we know there's one with null username)
	var userID string
	err = tx.QueryRow(`
		UPDATE users 
		SET username = $1 
		WHERE username IS NULL 
		RETURNING id
	`, userEmail).Scan(&userID)
	
	if err == sql.ErrNoRows {
		// If no user with null username, try to find existing user
		err = tx.QueryRow(`
			SELECT id FROM users WHERE username = $1
		`, userEmail).Scan(&userID)
		
		if err == sql.ErrNoRows {
			// Create new user if none exists
			err = tx.QueryRow(`
				INSERT INTO users (id, username, created_at) 
				VALUES (gen_random_uuid(), $1, NOW())
				RETURNING id
			`, userEmail).Scan(&userID)
		}
	}
	
	if err != nil {
		t.Fatalf("Failed to get or create user: %v", err)
	}
	
	t.Logf("✅ User ID: %s", userID)

	// Create a group for the import
	groupName := fmt.Sprintf("Omnivore Import %s", "2025-01-19")
	var groupID string
	err = tx.QueryRow(`
		INSERT INTO groups (id, name, created_by, created_at, join_code)
		VALUES (gen_random_uuid(), $1, $2, NOW(), substr(md5(random()::text), 1, 8))
		RETURNING id
	`, groupName, userID).Scan(&groupID)
	if err != nil {
		t.Fatalf("Failed to create group: %v", err)
	}
	
	t.Logf("✅ Created group: %s (ID: %s)", groupName, groupID)

	// Add user to group as owner
	_, err = tx.Exec(`
		INSERT INTO group_memberships (id, user_id, group_id, role, created_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())
	`, userID, groupID)
	if err != nil {
		t.Fatalf("Failed to add user to group: %v", err)
	}
	
	t.Log("✅ Added user to group as owner")

	// Create tags
	var omnivoreTagID, importTagID string
	
	// Create omnivore tag
	err = tx.QueryRow(`
		INSERT INTO tags (id, name, user_id, created_at)
		VALUES (gen_random_uuid(), 'omnivore', $1, NOW())
		RETURNING id
	`, userID).Scan(&omnivoreTagID)
	if err != nil {
		// Tag might already exist, try to get it
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			err = tx.QueryRow(`
				SELECT id FROM tags WHERE name = 'omnivore' AND user_id = $1
			`, userID).Scan(&omnivoreTagID)
		}
		if err != nil {
			t.Fatalf("Failed to create or get omnivore tag: %v", err)
		}
	}

	// Create import tag
	err = tx.QueryRow(`
		INSERT INTO tags (id, name, user_id, created_at)
		VALUES (gen_random_uuid(), 'import', $1, NOW())
		RETURNING id
	`, userID).Scan(&importTagID)
	if err != nil {
		// Tag might already exist, try to get it
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			err = tx.QueryRow(`
				SELECT id FROM tags WHERE name = 'import' AND user_id = $1
			`, userID).Scan(&importTagID)
		}
		if err != nil {
			t.Fatalf("Failed to create or get import tag: %v", err)
		}
	}
	
	t.Logf("✅ Tags created - omnivore: %s, import: %s", omnivoreTagID, importTagID)

	// Create parent list content
	listData := fmt.Sprintf("Omnivore Links Import - %d items", len(urls))
	var parentContentID string
	err = tx.QueryRow(`
		INSERT INTO content (id, type, data, group_id, user_id, created_at, updated_at)
		VALUES (gen_random_uuid(), 'list', $1, $2, $3, NOW(), NOW())
		RETURNING id
	`, listData, groupID, userID).Scan(&parentContentID)
	if err != nil {
		t.Fatalf("Failed to create parent list content: %v", err)
	}
	
	t.Logf("✅ Created parent list: %s", parentContentID)

	// Add tags to parent content
	_, err = tx.Exec(`
		INSERT INTO content_tags (content_id, tag_id, created_at)
		VALUES ($1, $2, NOW()), ($1, $3, NOW())
	`, parentContentID, omnivoreTagID, importTagID)
	if err != nil {
		t.Fatalf("Failed to add tags to parent content: %v", err)
	}
	
	t.Log("✅ Added tags to parent list")

	// Insert all URLs as child content items
	t.Logf("Inserting %d URLs as child content items...", len(urls))
	insertedCount := 0
	
	// Prepare statement for bulk insert
	stmt, err := tx.Prepare(`
		INSERT INTO content (id, type, data, group_id, user_id, parent_content_id, created_at, updated_at)
		VALUES (gen_random_uuid(), 'link', $1, $2, $3, $4, NOW(), NOW())
	`)
	if err != nil {
		t.Fatalf("Failed to prepare statement: %v", err)
	}
	defer stmt.Close()

	for i, url := range urls {
		_, err = stmt.Exec(url, groupID, userID, parentContentID)
		if err != nil {
			t.Logf("Warning: Failed to insert URL %d (%s): %v", i+1, url, err)
			continue
		}
		insertedCount++
		
		// Progress logging
		if (i+1)%100 == 0 {
			t.Logf("Progress: %d/%d URLs inserted", i+1, len(urls))
		}
	}
	
	t.Logf("✅ Successfully inserted %d/%d URLs", insertedCount, len(urls))

	// Commit transaction
	if err = tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}
	
	t.Log("✅ Transaction committed successfully")

	// Final verification queries (using db connection since tx is committed)
	t.Log("Verifying import...")
	
	// Verify parent list exists and count children
	var verifyParentID, verifyData string
	var childCount int
	err = db.QueryRow(`
		SELECT c.id, c.data, COUNT(child.id) as child_count
		FROM content c
		LEFT JOIN content child ON child.parent_content_id = c.id
		WHERE c.id = $1 AND c.type = 'list'
		GROUP BY c.id, c.data
	`, parentContentID).Scan(&verifyParentID, &verifyData, &childCount)
	if err != nil {
		t.Fatalf("Failed to verify parent list: %v", err)
	}
	
	t.Logf("✅ Parent list verified: %s (Children: %d)", verifyData, childCount)

	// Verify tags are applied
	var tagCount int
	err = db.QueryRow(`
		SELECT COUNT(*) FROM content_tags WHERE content_id = $1
	`, parentContentID).Scan(&tagCount)
	if err != nil {
		t.Fatalf("Failed to verify tags: %v", err)
	}
	
	t.Logf("✅ Tags applied: %d", tagCount)

	// Sample some child URLs
	rows, err := db.Query(`
		SELECT data FROM content 
		WHERE parent_content_id = $1 AND type = 'link'
		LIMIT 5
	`, parentContentID)
	if err != nil {
		t.Fatalf("Failed to query child items: %v", err)
	}
	defer rows.Close()

	t.Log("Sample imported URLs:")
	sampleCount := 0
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err != nil {
			continue
		}
		sampleCount++
		t.Logf("  - %s", url)
	}

	// Final summary
	t.Log("\n=== Import Summary ===")
	t.Logf("Total URLs found: %d", len(urls))
	t.Logf("Successfully imported: %d", insertedCount)
	t.Logf("Parent list ID: %s", parentContentID)
	t.Logf("Group ID: %s", groupID)
	t.Logf("User: %s (ID: %s)", userEmail, userID)
	t.Logf("Tags applied: omnivore, import")
	t.Log("✅ Import completed successfully!")
}

type HackerNewsArticle struct {
	Title string `json:"title"`
	URL   string `json:"url,omitempty"`
	HNId  int    `json:"hn_id"`
	Score int    `json:"score,omitempty"`
	Author string `json:"author,omitempty"`
}

func TestImportHackerNewsArticles(t *testing.T) {
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

	// Create HackerNews client
	ctx := context.Background()
	hnClient, err := gohn.NewClient(nil)
	if err != nil {
		t.Fatalf("Failed to create HackerNews client: %v", err)
	}

	t.Log("✅ Created HackerNews client")

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback() // Will be ignored if transaction is committed

	userEmail := "chris@breadchris.com"
	
	// Update existing user to set the username (we know there's one with null username)
	var userID string
	err = tx.QueryRow(`
		UPDATE users 
		SET username = $1 
		WHERE username IS NULL 
		RETURNING id
	`, userEmail).Scan(&userID)
	
	if err == sql.ErrNoRows {
		// If no user with null username, try to find existing user
		err = tx.QueryRow(`
			SELECT id FROM users WHERE username = $1
		`, userEmail).Scan(&userID)
		
		if err == sql.ErrNoRows {
			// Create new user if none exists
			err = tx.QueryRow(`
				INSERT INTO users (id, username, created_at) 
				VALUES (gen_random_uuid(), $1, NOW())
				RETURNING id
			`, userEmail).Scan(&userID)
		}
	}
	
	if err != nil {
		t.Fatalf("Failed to get or create user: %v", err)
	}
	
	t.Logf("✅ User ID: %s", userID)

	// Create a group for the import
	groupName := fmt.Sprintf("HackerNews Import %s", "2025-01-19")
	var groupID string
	err = tx.QueryRow(`
		INSERT INTO groups (id, name, created_by, created_at, join_code)
		VALUES (gen_random_uuid(), $1, $2, NOW(), substr(md5(random()::text), 1, 8))
		RETURNING id
	`, groupName, userID).Scan(&groupID)
	if err != nil {
		t.Fatalf("Failed to create group: %v", err)
	}
	
	t.Logf("✅ Created group: %s (ID: %s)", groupName, groupID)

	// Add user to group as owner
	_, err = tx.Exec(`
		INSERT INTO group_memberships (id, user_id, group_id, role, created_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())
	`, userID, groupID)
	if err != nil {
		t.Fatalf("Failed to add user to group: %v", err)
	}
	
	t.Log("✅ Added user to group as owner")

	// Create tags
	var hackerNewsTagID, importTagID string
	
	// Create hackernews tag
	err = tx.QueryRow(`
		INSERT INTO tags (id, name, user_id, created_at)
		VALUES (gen_random_uuid(), 'hackernews', $1, NOW())
		RETURNING id
	`, userID).Scan(&hackerNewsTagID)
	if err != nil {
		// Tag might already exist, try to get it
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			err = tx.QueryRow(`
				SELECT id FROM tags WHERE name = 'hackernews' AND user_id = $1
			`, userID).Scan(&hackerNewsTagID)
		}
		if err != nil {
			t.Fatalf("Failed to create or get hackernews tag: %v", err)
		}
	}

	// Create import tag
	err = tx.QueryRow(`
		INSERT INTO tags (id, name, user_id, created_at)
		VALUES (gen_random_uuid(), 'import', $1, NOW())
		RETURNING id
	`, userID).Scan(&importTagID)
	if err != nil {
		// Tag might already exist, try to get it
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			err = tx.QueryRow(`
				SELECT id FROM tags WHERE name = 'import' AND user_id = $1
			`, userID).Scan(&importTagID)
		}
		if err != nil {
			t.Fatalf("Failed to create or get import tag: %v", err)
		}
	}
	
	t.Logf("✅ Tags created - hackernews: %s, import: %s", hackerNewsTagID, importTagID)

	// Fetch HackerNews articles starting from ID 0
	const maxArticles = 100
	var articles []HackerNewsArticle
	
	t.Logf("Fetching up to %d HackerNews articles starting from ID 0...", maxArticles)
	
	for i := 0; i < maxArticles*2 && len(articles) < maxArticles; i++ {
		item, err := hnClient.Items.Get(ctx, i)
		if err != nil {
			t.Logf("Warning: Failed to fetch item %d: %v", i, err)
			continue
		}
		
		if item == nil {
			continue
		}
		
		// Filter for stories with URLs (skip comments, jobs, polls without URLs)
		if item.Type != nil && *item.Type == "story" && item.URL != nil && item.Title != nil {
			article := HackerNewsArticle{
				Title: *item.Title,
				URL:   *item.URL,
				HNId:  *item.ID,
			}
			if item.Score != nil {
				article.Score = *item.Score
			}
			if item.By != nil {
				article.Author = *item.By
			}
			articles = append(articles, article)
		}
		
		// Progress logging
		if (i+1)%25 == 0 {
			t.Logf("Progress: processed %d items, found %d articles", i+1, len(articles))
		}
	}
	
	t.Logf("✅ Found %d HackerNews articles", len(articles))

	if len(articles) == 0 {
		t.Fatal("No HackerNews articles found")
	}

	// Create parent list content
	listData := fmt.Sprintf("HackerNews Articles Import - %d items", len(articles))
	var parentContentID string
	err = tx.QueryRow(`
		INSERT INTO content (id, type, data, group_id, user_id, created_at, updated_at)
		VALUES (gen_random_uuid(), 'list', $1, $2, $3, NOW(), NOW())
		RETURNING id
	`, listData, groupID, userID).Scan(&parentContentID)
	if err != nil {
		t.Fatalf("Failed to create parent list content: %v", err)
	}
	
	t.Logf("✅ Created parent list: %s", parentContentID)

	// Add tags to parent content
	_, err = tx.Exec(`
		INSERT INTO content_tags (content_id, tag_id, created_at)
		VALUES ($1, $2, NOW()), ($1, $3, NOW())
	`, parentContentID, hackerNewsTagID, importTagID)
	if err != nil {
		t.Fatalf("Failed to add tags to parent content: %v", err)
	}
	
	t.Log("✅ Added tags to parent list")

	// Insert all articles as child content items
	t.Logf("Inserting %d articles as child content items...", len(articles))
	insertedCount := 0
	
	// Prepare statement for bulk insert
	stmt, err := tx.Prepare(`
		INSERT INTO content (id, type, data, group_id, user_id, parent_content_id, created_at, updated_at)
		VALUES (gen_random_uuid(), 'link', $1, $2, $3, $4, NOW(), NOW())
	`)
	if err != nil {
		t.Fatalf("Failed to prepare statement: %v", err)
	}
	defer stmt.Close()

	for i, article := range articles {
		// Convert article to JSON
		articleData, err := json.Marshal(article)
		if err != nil {
			t.Logf("Warning: Failed to marshal article %d: %v", i+1, err)
			continue
		}
		
		_, err = stmt.Exec(string(articleData), groupID, userID, parentContentID)
		if err != nil {
			t.Logf("Warning: Failed to insert article %d (%s): %v", i+1, article.Title, err)
			continue
		}
		insertedCount++
		
		// Progress logging
		if (i+1)%25 == 0 {
			t.Logf("Progress: %d/%d articles inserted", i+1, len(articles))
		}
	}
	
	t.Logf("✅ Successfully inserted %d/%d articles", insertedCount, len(articles))

	// Commit transaction
	if err = tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}
	
	t.Log("✅ Transaction committed successfully")

	// Final verification queries (using db connection since tx is committed)
	t.Log("Verifying import...")
	
	// Verify parent list exists and count children
	var verifyParentID, verifyData string
	var childCount int
	err = db.QueryRow(`
		SELECT c.id, c.data, COUNT(child.id) as child_count
		FROM content c
		LEFT JOIN content child ON child.parent_content_id = c.id
		WHERE c.id = $1 AND c.type = 'list'
		GROUP BY c.id, c.data
	`, parentContentID).Scan(&verifyParentID, &verifyData, &childCount)
	if err != nil {
		t.Fatalf("Failed to verify parent list: %v", err)
	}
	
	t.Logf("✅ Parent list verified: %s (Children: %d)", verifyData, childCount)

	// Verify tags are applied
	var tagCount int
	err = db.QueryRow(`
		SELECT COUNT(*) FROM content_tags WHERE content_id = $1
	`, parentContentID).Scan(&tagCount)
	if err != nil {
		t.Fatalf("Failed to verify tags: %v", err)
	}
	
	t.Logf("✅ Tags applied: %d", tagCount)

	// Sample some child articles
	rows, err := db.Query(`
		SELECT data FROM content 
		WHERE parent_content_id = $1 AND type = 'link'
		LIMIT 5
	`, parentContentID)
	if err != nil {
		t.Fatalf("Failed to query child items: %v", err)
	}
	defer rows.Close()

	t.Log("Sample imported articles:")
	sampleCount := 0
	for rows.Next() {
		var articleData string
		if err := rows.Scan(&articleData); err != nil {
			continue
		}
		
		var article HackerNewsArticle
		if err := json.Unmarshal([]byte(articleData), &article); err != nil {
			continue
		}
		
		sampleCount++
		t.Logf("  - [HN:%d] %s (Score: %d) - %s", article.HNId, article.Title, article.Score, article.URL)
	}

	// Final summary
	t.Log("\n=== Import Summary ===")
	t.Logf("Total articles found: %d", len(articles))
	t.Logf("Successfully imported: %d", insertedCount)
	t.Logf("Parent list ID: %s", parentContentID)
	t.Logf("Group ID: %s", groupID)
	t.Logf("User: %s (ID: %s)", userEmail, userID)
	t.Logf("Tags applied: hackernews, import")
	t.Log("✅ HackerNews import completed successfully!")
}