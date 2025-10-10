package main

import (
	"database/sql"
	"encoding/json"
	"testing"

	_ "github.com/lib/pq"
)

// TestVerifyImport checks which batches were successfully imported
func TestVerifyImport(t *testing.T) {
	t.Log("🔍 Verifying IMDb Import Status...")

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

	// Get the upload group
	var groupID string
	err = db.QueryRow(`
		SELECT id FROM groups WHERE name = 'upload'
	`).Scan(&groupID)

	if err == sql.ErrNoRows {
		t.Fatal("❌ No 'upload' group found - import may not have started")
	}
	if err != nil {
		t.Fatalf("Failed to query group: %v", err)
	}

	t.Logf("📁 Found 'upload' group: %s", groupID)

	// Count total content in the group
	var totalContent int
	err = db.QueryRow(`
		SELECT COUNT(*) FROM content WHERE group_id = $1 AND type = 'movie'
	`, groupID).Scan(&totalContent)

	if err != nil {
		t.Fatalf("Failed to count content: %v", err)
	}

	t.Logf("📊 Total movies imported: %d", totalContent)

	// Calculate expected batches (1000 per batch)
	batchSize := 1000
	completedBatches := totalContent / batchSize
	remainingInPartialBatch := totalContent % batchSize

	t.Logf("📦 Completed full batches: %d", completedBatches)
	if remainingInPartialBatch > 0 {
		t.Logf("📦 Partial batch: %d movies", remainingInPartialBatch)
	}

	// Sample first and last titles from each completed batch
	t.Log("\n🎬 Sampling titles from batches:")

	// Sample batches: first, every 10th, and last
	batchesToSample := []int{1, 10, 20, 30}
	if completedBatches > 0 && completedBatches < 40 {
		batchesToSample = append(batchesToSample, completedBatches)
	}

	for _, batchNum := range batchesToSample {
		if batchNum > completedBatches {
			continue
		}

		// Calculate offset for this batch
		offset := (batchNum - 1) * batchSize

		// Get first and last title from this batch
		rows, err := db.Query(`
			SELECT data, metadata
			FROM content
			WHERE group_id = $1 AND type = 'movie'
			ORDER BY created_at
			LIMIT 2
			OFFSET $2
		`, groupID, offset)

		if err != nil {
			t.Logf("  ⚠️  Batch %d: Failed to query - %v", batchNum, err)
			continue
		}

		var titles []struct {
			data     string
			metadata string
		}

		for rows.Next() {
			var data, metadata string
			if err := rows.Scan(&data, &metadata); err != nil {
				continue
			}
			titles = append(titles, struct {
				data     string
				metadata string
			}{data, metadata})
		}
		rows.Close()

		// Also get last title from this batch
		var lastData, lastMetadata string
		err = db.QueryRow(`
			SELECT data, metadata
			FROM content
			WHERE group_id = $1 AND type = 'movie'
			ORDER BY created_at
			LIMIT 1
			OFFSET $2
		`, groupID, offset+batchSize-1).Scan(&lastData, &lastMetadata)

		if err != nil && err != sql.ErrNoRows {
			t.Logf("  ⚠️  Batch %d: Failed to get last title - %v", batchNum, err)
		}

		t.Logf("\n  📦 Batch %d (movies %d-%d):", batchNum, offset+1, offset+batchSize)

		if len(titles) > 0 {
			// Parse first title metadata
			var firstTitle IMDbTitle
			if err := json.Unmarshal([]byte(titles[0].metadata), &firstTitle); err == nil {
				t.Logf("    First: %s (%s, %s)", firstTitle.PrimaryTitle, firstTitle.TitleID, firstTitle.TitleType)
			} else {
				t.Logf("    First: %s", titles[0].data)
			}
		}

		if err == nil {
			// Parse last title metadata
			var lastTitle IMDbTitle
			if err := json.Unmarshal([]byte(lastMetadata), &lastTitle); err == nil {
				t.Logf("    Last:  %s (%s, %s)", lastTitle.PrimaryTitle, lastTitle.TitleID, lastTitle.TitleType)
			} else {
				t.Logf("    Last:  %s", lastData)
			}
		}
	}

	// Check for gaps in the import (by checking created_at timestamps)
	t.Log("\n⏱️  Checking for batch timing:")

	rows, err := db.Query(`
		WITH batch_stats AS (
			SELECT
				((ROW_NUMBER() OVER (ORDER BY created_at) - 1) / $1) + 1 as batch_num,
				MIN(created_at) as batch_start,
				MAX(created_at) as batch_end,
				COUNT(*) as count
			FROM content
			WHERE group_id = $2 AND type = 'movie'
			GROUP BY batch_num
			ORDER BY batch_num
		)
		SELECT batch_num, batch_start, batch_end, count
		FROM batch_stats
		WHERE batch_num <= 5 OR batch_num > (SELECT MAX(batch_num) - 5 FROM batch_stats)
		ORDER BY batch_num
	`, batchSize, groupID)

	if err != nil {
		t.Logf("  ⚠️  Failed to get batch timing: %v", err)
	} else {
		defer rows.Close()

		for rows.Next() {
			var batchNum int
			var batchStart, batchEnd string
			var count int

			if err := rows.Scan(&batchNum, &batchStart, &batchEnd, &count); err != nil {
				continue
			}

			t.Logf("  Batch %3d: %d movies, started %s", batchNum, count, batchStart)
		}
	}

	t.Log("\n📊 Summary:")
	t.Logf("  ✅ Total movies successfully imported: %d", totalContent)
	t.Logf("  ✅ Full batches completed: %d", completedBatches)
	if remainingInPartialBatch > 0 {
		t.Logf("  ⚠️  Partial batch: %d movies (import likely interrupted)", remainingInPartialBatch)
	}

	expectedTotal := 846086 // From the log: "✅ Loaded 846086 IMDb titles for import"
	percentComplete := float64(totalContent) / float64(expectedTotal) * 100
	t.Logf("  📈 Progress: %.1f%% of total dataset (%d / %d)", percentComplete, totalContent, expectedTotal)
}
