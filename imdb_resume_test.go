package main

import (
	"database/sql"
	"testing"

	_ "github.com/lib/pq"
)

// TestIMDbImport_Resume continues importing from where the last run stopped
// Can be run multiple times - will always resume from the last imported batch
// Timeout set to 48 hours to ensure completion of full dataset
func TestIMDbImport_Resume(t *testing.T) {
	t.Log("🔄 Starting Resumable IMDb Import...")

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

	// Load ALL IMDb data (0 = no limit)
	t.Log("📥 Loading IMDb datasets (this will take several minutes)...")
	titles, err := loadAndProcessIMDbData(0)
	if err != nil {
		t.Fatalf("Failed to load IMDb data: %v", err)
	}

	t.Logf("✅ Loaded %d IMDb titles total", len(titles))

	userEmail := "chris@breadchris.com"
	batchSize := 1000

	// Check current import status
	var groupID string
	var alreadyImported int

	err = db.QueryRow(`
		SELECT g.id, COUNT(c.id)
		FROM groups g
		LEFT JOIN content c ON c.group_id = g.id AND c.type = 'movie'
		WHERE g.name = 'upload'
		GROUP BY g.id
	`).Scan(&groupID, &alreadyImported)

	if err == sql.ErrNoRows {
		alreadyImported = 0
		t.Log("📁 No existing 'upload' group - starting fresh import")
	} else if err != nil {
		t.Fatalf("Failed to check import status: %v", err)
	} else {
		t.Logf("📁 Found existing 'upload' group with %d movies", alreadyImported)
	}

	// Calculate where to resume
	startBatch := (alreadyImported / batchSize)
	if alreadyImported%batchSize == 0 && alreadyImported > 0 {
		startBatch++ // Start at next batch if previous batch was complete
	} else if alreadyImported%batchSize != 0 {
		// Partial batch - need to clean it up and restart from that batch
		t.Logf("⚠️  Found partial batch (%d movies in batch %d)", alreadyImported%batchSize, startBatch+1)

		// Delete partial batch to restart it cleanly
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("Failed to start cleanup transaction: %v", err)
		}

		// Get the timestamp of the first movie in the partial batch
		var partialBatchStart string
		partialBatchOffset := (startBatch) * batchSize

		err = tx.QueryRow(`
			SELECT created_at
			FROM content
			WHERE group_id = $1 AND type = 'movie'
			ORDER BY created_at
			LIMIT 1
			OFFSET $2
		`, groupID, partialBatchOffset).Scan(&partialBatchStart)

		if err != nil && err != sql.ErrNoRows {
			tx.Rollback()
			t.Fatalf("Failed to get partial batch timestamp: %v", err)
		}

		if partialBatchStart != "" {
			// Delete all movies from the partial batch onwards
			result, err := tx.Exec(`
				DELETE FROM content
				WHERE group_id = $1 AND type = 'movie' AND created_at >= $2
			`, groupID, partialBatchStart)

			if err != nil {
				tx.Rollback()
				t.Fatalf("Failed to delete partial batch: %v", err)
			}

			deleted, _ := result.RowsAffected()
			t.Logf("🗑️  Deleted %d movies from partial batch", deleted)
		}

		if err := tx.Commit(); err != nil {
			t.Fatalf("Failed to commit cleanup: %v", err)
		}

		alreadyImported = partialBatchOffset
		startBatch++
	} else {
		startBatch = 1 // Fresh start
	}

	remaining := len(titles) - alreadyImported
	totalBatches := (len(titles) + batchSize - 1) / batchSize
	batchesToProcess := (remaining + batchSize - 1) / batchSize

	t.Logf("📊 Import Status:")
	t.Logf("   - Already imported: %d movies (%d batches)", alreadyImported, startBatch-1)
	t.Logf("   - Remaining: %d movies (%d batches)", remaining, batchesToProcess)
	t.Logf("   - Total: %d movies (%d batches)", len(titles), totalBatches)
	t.Logf("   - Starting from batch: %d", startBatch)
	t.Log("📁 Using shared \"upload\" group for all batches")

	if remaining == 0 {
		t.Log("✅ Import already complete!")
		return
	}

	var finalResult *IMDbImportResult

	// Process remaining batches
	for batchNum := startBatch; batchNum <= totalBatches; batchNum++ {
		start := (batchNum - 1) * batchSize
		end := start + batchSize
		if end > len(titles) {
			end = len(titles)
		}

		batchTitles := titles[start:end]
		t.Logf("📦 Batch %d/%d: Importing %d movies (titles %d-%d)...",
			batchNum, totalBatches, len(batchTitles), start+1, end)

		// Refresh database connection every 10 batches to prevent timeouts
		if (batchNum-startBatch)%10 == 0 && batchNum != startBatch {
			db.Close()
			db, err = sql.Open("postgres", dbURL)
			if err != nil {
				t.Fatalf("Failed to reconnect to database at batch %d: %v", batchNum, err)
			}
			if err := db.Ping(); err != nil {
				t.Fatalf("Failed to ping database at batch %d: %v", batchNum, err)
			}
			t.Logf("🔄 Database connection refreshed at batch %d", batchNum)
		}

		// Start new transaction for this batch with retry logic
		var tx *sql.Tx
		retries := 3
		for i := 0; i < retries; i++ {
			tx, err = db.Begin()
			if err == nil {
				break
			}
			if i < retries-1 {
				t.Logf("⚠️  Failed to start transaction (attempt %d/%d), retrying...", i+1, retries)
				// Reconnect on connection error
				db.Close()
				db, _ = sql.Open("postgres", dbURL)
				db.Ping()
			}
		}
		if err != nil {
			t.Fatalf("Failed to start transaction for batch %d after %d attempts: %v", batchNum, retries, err)
		}

		// For first batch of this run, create group if needed
		// For subsequent batches, reuse existing group
		var result *IMDbImportResult
		if batchNum == 1 || (batchNum == startBatch && alreadyImported == 0) {
			// First batch ever - create everything
			result, err = imdbImport(tx, batchTitles, userEmail)
		} else {
			// Subsequent batches - insert into existing group
			if finalResult == nil {
				// This is a resume - need to get the existing group info
				var userID, parentContentID string
				err = tx.QueryRow(`
					SELECT created_by FROM groups WHERE id = $1
				`, groupID).Scan(&userID)

				if err != nil {
					tx.Rollback()
					t.Fatalf("Failed to get user ID: %v", err)
				}

				// Get or create parent content
				err = tx.QueryRow(`
					SELECT id FROM content
					WHERE group_id = $1 AND type = 'list'
					ORDER BY created_at
					LIMIT 1
				`, groupID).Scan(&parentContentID)

				if err == sql.ErrNoRows {
					// Create parent content if it doesn't exist
					listData := "IMDb Titles Import"
					err = tx.QueryRow(`
						INSERT INTO content (id, type, data, group_id, user_id, created_at, updated_at)
						VALUES (gen_random_uuid(), 'list', $1, $2, $3, NOW(), NOW())
						RETURNING id
					`, listData, groupID, userID).Scan(&parentContentID)
				}

				if err != nil {
					tx.Rollback()
					t.Fatalf("Failed to get/create parent content: %v", err)
				}

				finalResult = &IMDbImportResult{
					UserID:          userID,
					GroupID:         groupID,
					GroupName:       "upload",
					ParentContentID: parentContentID,
				}
			}

			result, err = imdbImportBatch(tx, batchTitles, finalResult.UserID,
				finalResult.GroupID, finalResult.ParentContentID)
		}

		if err != nil {
			tx.Rollback()
			t.Fatalf("Failed to import batch %d: %v", batchNum, err)
		}

		// Commit this batch with retry logic
		commitRetries := 3
		var commitErr error
		for i := 0; i < commitRetries; i++ {
			commitErr = tx.Commit()
			if commitErr == nil {
				break
			}
			if i < commitRetries-1 {
				t.Logf("⚠️  Failed to commit batch %d (attempt %d/%d): %v, retrying...", batchNum, i+1, commitRetries, commitErr)
				// On commit failure, need to restart transaction
				tx.Rollback()

				// Reconnect
				db.Close()
				db, _ = sql.Open("postgres", dbURL)
				db.Ping()

				// Retry the entire batch
				tx, err = db.Begin()
				if err != nil || tx == nil {
					t.Logf("⚠️  Failed to begin transaction: %v", err)
					continue
				}

				if batchNum == 1 || (batchNum == startBatch && alreadyImported == 0) {
					result, err = imdbImport(tx, batchTitles, userEmail)
				} else {
					result, err = imdbImportBatch(tx, batchTitles, finalResult.UserID,
						finalResult.GroupID, finalResult.ParentContentID)
				}

				if err != nil {
					tx.Rollback()
					continue
				}
			}
		}

		if commitErr != nil {
			t.Fatalf("Failed to commit batch %d after %d attempts: %v", batchNum, commitRetries, commitErr)
		}

		if batchNum == 1 || (batchNum == startBatch && alreadyImported == 0) {
			finalResult = result
		} else {
			// Accumulate totals
			if finalResult != nil {
				finalResult.TotalTitles += result.TotalTitles
				finalResult.ContentCreated += result.ContentCreated
				finalResult.InsertedCount += result.InsertedCount
			}
		}

		percentComplete := float64(end) / float64(len(titles)) * 100
		t.Logf("✅ Batch %d/%d completed (%d movies) - %.1f%% complete",
			batchNum, totalBatches, result.InsertedCount, percentComplete)
	}

	t.Log("✅ All batches committed successfully - all data persisted to database")

	if finalResult != nil {
		totalImported := alreadyImported + finalResult.InsertedCount
		t.Logf("📊 Final Import Summary:")
		t.Logf("   - User ID: %s", finalResult.UserID)
		t.Logf("   - Group ID: %s", finalResult.GroupID)
		t.Logf("   - Group Name: %s", finalResult.GroupName)
		t.Logf("   - Total Titles in Dataset: %d", len(titles))
		t.Logf("   - Total Imported (all runs): %d", totalImported)
		t.Logf("   - This Run: %d titles in %d batches", finalResult.InsertedCount, batchesToProcess)
	}

	t.Log("🎉 IMDb import completed successfully!")
}
