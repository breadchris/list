package main

import (
	"bufio"
	"fmt"
	"io/fs"
	"mime"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/urfave/cli/v2"
)

// Default file type to content type mappings
var defaultTypeMapping = map[string]string{
	".txt":  "text",
	".md":   "text",
	".json": "text",
	".js":   "text",
	".ts":   "text",
	".jsx":  "text",
	".tsx":  "text",
	".html": "text",
	".css":  "text",
	".xml":  "text",
	".yaml": "text",
	".yml":  "text",
	".toml": "text",
	".ini":  "text",
	".conf": "text",
	".log":  "text",
	".sh":   "text",
	".bash": "text",
	".py":   "text",
	".go":   "text",
	".rs":   "text",
	".c":    "text",
	".cpp":  "text",
	".h":    "text",
	".java": "text",
	".rb":   "text",
	".php":  "text",
	".sql":  "text",

	".jpg":  "image",
	".jpeg": "image",
	".png":  "image",
	".gif":  "image",
	".webp": "image",
	".svg":  "image",
	".bmp":  "image",
	".ico":  "image",

	".mp4":  "video",
	".mov":  "video",
	".avi":  "video",
	".mkv":  "video",
	".webm": "video",
	".flv":  "video",
	".wmv":  "video",

	".mp3":  "audio",
	".wav":  "audio",
	".m4a":  "audio",
	".flac": "audio",
	".ogg":  "audio",
	".aac":  "audio",

	".pdf":  "document",
	".doc":  "document",
	".docx": "document",
	".xls":  "document",
	".xlsx": "document",
	".ppt":  "document",
	".pptx": "document",

	".zip":  "archive",
	".tar":  "archive",
	".gz":   "archive",
	".bz2":  "archive",
	".7z":   "archive",
	".rar":  "archive",
}

// importCommand handles the import CLI command
func importCommand(c *cli.Context) error {
	// Check for directory argument
	if c.NArg() == 0 {
		return fmt.Errorf("directory path is required\nUsage: go run . import <directory> [flags]")
	}

	directory := c.Args().Get(0)

	// Validate directory exists
	if _, err := os.Stat(directory); os.IsNotExist(err) {
		return fmt.Errorf("directory does not exist: %s", directory)
	}

	// Load Supabase configuration
	config, err := LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Build import configuration
	importConfig := &ImportConfig{
		RootDir:     directory,
		UserID:      c.String("user-id"),
		GroupID:     c.String("group-id"),
		SkipHidden:  c.Bool("skip-hidden"),
		MaxFileSize: int64(c.Int("max-file-size")) * 1024 * 1024, // Convert MB to bytes
		DryRun:      c.Bool("dry-run"),
		Verbose:     c.Bool("verbose"),
	}

	// Validate required user ID
	if importConfig.UserID == "" {
		return fmt.Errorf("--user-id flag is required")
	}

	fmt.Printf("🔍 Scanning directory: %s\n", directory)

	// Walk directory and build index
	fileIndex, err := walkDirectory(directory, importConfig.SkipHidden, importConfig.MaxFileSize)
	if err != nil {
		return fmt.Errorf("failed to scan directory: %w", err)
	}

	if len(fileIndex) == 0 {
		fmt.Println("❌ No files found in directory")
		return nil
	}

	// Calculate statistics
	stats := calculateFileTypeStats(fileIndex)
	totalFiles := len(fileIndex) - countDirectories(fileIndex)
	totalDirs := countDirectories(fileIndex)

	fmt.Printf("Found %d files and %d folders\n", totalFiles, totalDirs)

	// Early warning for very large imports
	if totalFiles > 5000 {
		fmt.Printf("\n⚠️  WARNING: This is a very large import (%d files)\n", totalFiles)
		fmt.Println("This may take a significant amount of time and could hit rate limits.")
		fmt.Println("Consider breaking this into smaller batches or using --dry-run first.")
		if !promptConfirmation("\nContinue with scan?") {
			fmt.Println("Scan cancelled")
			return nil
		}
	} else if totalFiles > 2000 {
		fmt.Printf("\n⚠️  Note: Large import detected (%d files)\n", totalFiles)
		fmt.Println("This may take several minutes to complete.")
	}

	fmt.Println()

	// Display file type statistics
	displayFileTypeStats(stats)

	// Interactive file type selection
	selectedTypes, err := promptFileTypeSelection(stats)
	if err != nil {
		return fmt.Errorf("file type selection failed: %w", err)
	}

	importConfig.SelectedTypes = selectedTypes

	// Filter file index to only selected types
	fileIndex = filterBySelectedTypes(fileIndex, selectedTypes)

	if len(fileIndex) == 0 {
		fmt.Println("❌ No files match selected types")
		return nil
	}

	// Interactive content type mapping
	typeMappings, err := promptContentTypeMapping(selectedTypes)
	if err != nil {
		return fmt.Errorf("content type mapping failed: %w", err)
	}

	importConfig.TypeMappings = typeMappings

	// Create Supabase client
	client := NewSupabaseClient(config.SupabaseURL, config.SupabaseKey)

	// Interactive group selection if not provided
	if importConfig.GroupID == "" {
		groupID, err := promptGroupSelection(client, importConfig.UserID)
		if err != nil {
			return fmt.Errorf("group selection failed: %w", err)
		}
		importConfig.GroupID = groupID
	}

	// Verify group exists
	group, err := client.GetGroup(importConfig.GroupID)
	if err != nil {
		return fmt.Errorf("failed to verify group: %w", err)
	}

	// Display import summary and confirm
	if err := displayImportSummary(importConfig, fileIndex, group.Name); err != nil {
		return err
	}

	if !importConfig.DryRun {
		if !promptConfirmation("Continue with import?") {
			fmt.Println("Import cancelled")
			return nil
		}
	}

	// Perform the import
	if importConfig.DryRun {
		fmt.Println("\n🔍 DRY RUN MODE - No changes will be made\n")
		fmt.Println("Files that would be imported:")
		for _, file := range fileIndex {
			fmt.Printf("  %s (%s)\n", file.RelativePath, formatFileSize(file.Size))
		}
		return nil
	}

	fmt.Println("\n📤 Starting import...\n")

	err = performImport(importConfig, fileIndex, client)
	if err != nil {
		return fmt.Errorf("import failed: %w", err)
	}

	return nil
}

// walkDirectory recursively walks a directory and builds a file index
func walkDirectory(rootPath string, skipHidden bool, maxFileSize int64) ([]FileIndex, error) {
	var fileIndex []FileIndex
	var skippedFiles []string
	var skippedHiddenCount int

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip hidden files/directories if configured
		if skipHidden && strings.HasPrefix(d.Name(), ".") && path != rootPath {
			if d.IsDir() {
				skippedHiddenCount++
				return filepath.SkipDir
			}
			skippedHiddenCount++
			return nil
		}

		// Get file info
		info, err := d.Info()
		if err != nil {
			return err
		}

		// Skip files larger than max size
		if !d.IsDir() && info.Size() > maxFileSize {
			relPath, _ := filepath.Rel(rootPath, path)
			skippedFiles = append(skippedFiles, fmt.Sprintf("%s (%s)", relPath, formatFileSize(info.Size())))
			return nil
		}

		// Calculate relative path
		relPath, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}

		// Skip root directory itself
		if relPath == "." {
			return nil
		}

		// Determine MIME type
		mimeType := mime.TypeByExtension(filepath.Ext(path))

		fileIndex = append(fileIndex, FileIndex{
			Path:         path,
			RelativePath: relPath,
			Size:         info.Size(),
			Extension:    strings.ToLower(filepath.Ext(path)),
			ModTime:      info.ModTime(),
			IsDir:        d.IsDir(),
			MimeType:     mimeType,
		})

		return nil
	})

	// Report skipped files
	if len(skippedFiles) > 0 {
		fmt.Printf("\n⚠️  Skipped %d files exceeding size limit (%s):\n", len(skippedFiles), formatFileSize(maxFileSize))
		for i := 0; i < len(skippedFiles) && i < 10; i++ {
			fmt.Printf("    • %s\n", skippedFiles[i])
		}
		if len(skippedFiles) > 10 {
			fmt.Printf("    ... and %d more\n", len(skippedFiles)-10)
		}
		fmt.Printf("\n💡 Tip: Use --max-file-size to increase the limit\n\n")
	}

	if skippedHiddenCount > 0 {
		fmt.Printf("ℹ️  Skipped %d hidden files/folders (use --skip-hidden=false to include)\n\n", skippedHiddenCount)
	}

	return fileIndex, err
}

// calculateFileTypeStats calculates statistics about file types
func calculateFileTypeStats(fileIndex []FileIndex) []FileTypeStats {
	statsMap := make(map[string]*FileTypeStats)

	for _, file := range fileIndex {
		if file.IsDir {
			continue
		}

		ext := file.Extension
		if ext == "" {
			ext = "(no extension)"
		}

		if stats, exists := statsMap[ext]; exists {
			stats.Count++
			stats.TotalSize += file.Size
		} else {
			statsMap[ext] = &FileTypeStats{
				Extension: ext,
				Count:     1,
				TotalSize: file.Size,
			}
		}
	}

	// Convert map to slice and sort by count
	var stats []FileTypeStats
	for _, s := range statsMap {
		stats = append(stats, *s)
	}

	sort.Slice(stats, func(i, j int) bool {
		return stats[i].Count > stats[j].Count
	})

	return stats
}

// countDirectories counts the number of directories in the file index
func countDirectories(fileIndex []FileIndex) int {
	count := 0
	for _, file := range fileIndex {
		if file.IsDir {
			count++
		}
	}
	return count
}

// displayFileTypeStats displays file type statistics
func displayFileTypeStats(stats []FileTypeStats) {
	fmt.Println("File Types Found:")
	for _, s := range stats {
		fmt.Printf("  %s (%d files, %s)\n", s.Extension, s.Count, formatFileSize(s.TotalSize))
	}
	fmt.Println()
}

// formatFileSize formats a file size in bytes to a human-readable string
func formatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// promptFileTypeSelection prompts the user to select file types to import
func promptFileTypeSelection(stats []FileTypeStats) ([]string, error) {
	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Select file types to import (comma-separated, e.g., .txt,.md or 'all'): ")
	input, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	input = strings.TrimSpace(input)

	if strings.ToLower(input) == "all" {
		var allTypes []string
		for _, s := range stats {
			allTypes = append(allTypes, s.Extension)
		}
		return allTypes, nil
	}

	// Parse comma-separated list
	types := strings.Split(input, ",")
	var selectedTypes []string
	for _, t := range types {
		t = strings.TrimSpace(t)
		if t != "" {
			// Add leading dot if not present
			if !strings.HasPrefix(t, ".") && t != "(no extension)" {
				t = "." + t
			}
			selectedTypes = append(selectedTypes, t)
		}
	}

	if len(selectedTypes) == 0 {
		return nil, fmt.Errorf("no file types selected")
	}

	return selectedTypes, nil
}

// filterBySelectedTypes filters the file index to only include selected file types
func filterBySelectedTypes(fileIndex []FileIndex, selectedTypes []string) []FileIndex {
	var filtered []FileIndex

	// Create a map for faster lookup
	typeMap := make(map[string]bool)
	for _, t := range selectedTypes {
		typeMap[t] = true
	}

	for _, file := range fileIndex {
		// Always include directories
		if file.IsDir {
			filtered = append(filtered, file)
			continue
		}

		// Check if file extension is in selected types
		ext := file.Extension
		if ext == "" {
			ext = "(no extension)"
		}

		if typeMap[ext] {
			filtered = append(filtered, file)
		}
	}

	return filtered
}

// promptContentTypeMapping prompts the user to map file extensions to content types
func promptContentTypeMapping(extensions []string) (map[string]string, error) {
	reader := bufio.NewReader(os.Stdin)
	mappings := make(map[string]string)

	fmt.Println("\nContent Type Mapping:")
	fmt.Println("Press Enter to use default mapping, or type a custom content type")
	fmt.Println()

	for _, ext := range extensions {
		defaultType := defaultTypeMapping[ext]
		if defaultType == "" {
			defaultType = "text"
		}

		fmt.Printf("  %s → %s (default) [Enter to confirm or type new]: ", ext, defaultType)
		input, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}

		input = strings.TrimSpace(input)
		if input == "" {
			mappings[ext] = defaultType
		} else {
			mappings[ext] = input
		}
	}

	fmt.Println()
	return mappings, nil
}

// promptGroupSelection prompts the user to select a group
func promptGroupSelection(client *SupabaseClient, userID string) (string, error) {
	// Fetch user's group memberships
	memberships, err := client.GetGroupMemberships(userID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch group memberships: %w", err)
	}

	if len(memberships) == 0 {
		return "", fmt.Errorf("user is not a member of any groups")
	}

	fmt.Println("Available groups:")
	for i, m := range memberships {
		groupName := "Unknown"
		if m.Group != nil {
			groupName = m.Group.Name
		}
		fmt.Printf("  %d) %s (%s)\n", i+1, groupName, m.GroupID)
	}
	fmt.Println()

	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Select group (number or UUID): ")
	input, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}

	input = strings.TrimSpace(input)

	// Try to parse as number first
	if num, err := strconv.Atoi(input); err == nil {
		if num >= 1 && num <= len(memberships) {
			return memberships[num-1].GroupID, nil
		}
		return "", fmt.Errorf("invalid group number: %d", num)
	}

	// Otherwise, assume it's a UUID
	return input, nil
}

// displayImportSummary displays a summary of the import operation and gets user confirmation
func displayImportSummary(config *ImportConfig, fileIndex []FileIndex, groupName string) error {
	totalFiles := 0
	totalDirs := 0
	totalSize := int64(0)
	largeFiles := []FileIndex{}

	for _, file := range fileIndex {
		if file.IsDir {
			totalDirs++
		} else {
			totalFiles++
			totalSize += file.Size

			// Track files larger than 5 MB
			if file.Size > 5*1024*1024 {
				largeFiles = append(largeFiles, file)
			}
		}
	}

	// Check for warnings
	warnings := []string{}

	// Warning: Large number of files
	if totalFiles > 1000 {
		warnings = append(warnings, fmt.Sprintf("⚠️  Large import: %d files (may take several minutes)", totalFiles))
	} else if totalFiles > 500 {
		warnings = append(warnings, fmt.Sprintf("⚠️  Medium import: %d files (may take a few minutes)", totalFiles))
	}

	// Warning: Large total size
	if totalSize > 100*1024*1024 { // > 100 MB
		warnings = append(warnings, fmt.Sprintf("⚠️  Large total size: %s (may take a while to upload)", formatFileSize(totalSize)))
	}

	// Warning: Individual large files
	if len(largeFiles) > 0 {
		warnings = append(warnings, fmt.Sprintf("⚠️  %d files larger than 5 MB detected", len(largeFiles)))
	}

	// Warning: Files near size limit
	nearLimitFiles := 0
	for _, file := range fileIndex {
		if !file.IsDir && file.Size > int64(float64(config.MaxFileSize)*0.8) {
			nearLimitFiles++
		}
	}
	if nearLimitFiles > 0 {
		warnings = append(warnings, fmt.Sprintf("⚠️  %d files near size limit (%s)", nearLimitFiles, formatFileSize(config.MaxFileSize)))
	}

	fmt.Println("─────────────────────────────────────────")
	fmt.Println("Import Summary")
	fmt.Println("─────────────────────────────────────────")
	fmt.Printf("Directory:     %s\n", config.RootDir)
	fmt.Printf("Total files:   %d\n", totalFiles)
	fmt.Printf("Folders:       %d\n", totalDirs)
	fmt.Printf("Total size:    %s\n", formatFileSize(totalSize))
	fmt.Printf("File types:    %s\n", strings.Join(config.SelectedTypes, ", "))
	fmt.Printf("Target group:  %s (%s)\n", groupName, config.GroupID)
	fmt.Printf("User ID:       %s\n", config.UserID)
	fmt.Printf("Max file size: %s\n", formatFileSize(config.MaxFileSize))
	fmt.Printf("Skip hidden:   %v\n", config.SkipHidden)
	fmt.Println("─────────────────────────────────────────")

	// Display warnings if any
	if len(warnings) > 0 {
		fmt.Println()
		fmt.Println("⚠️  WARNINGS:")
		for _, warning := range warnings {
			fmt.Printf("    %s\n", warning)
		}
		fmt.Println()

		// Show largest files if there are large files
		if len(largeFiles) > 0 {
			fmt.Println("Largest files:")
			// Sort by size descending
			sort.Slice(largeFiles, func(i, j int) bool {
				return largeFiles[i].Size > largeFiles[j].Size
			})

			// Show top 5 largest files
			for i := 0; i < len(largeFiles) && i < 5; i++ {
				fmt.Printf("    • %s (%s)\n", largeFiles[i].RelativePath, formatFileSize(largeFiles[i].Size))
			}
			if len(largeFiles) > 5 {
				fmt.Printf("    ... and %d more large files\n", len(largeFiles)-5)
			}
			fmt.Println()
		}

		fmt.Println("💡 Tip: Use --dry-run to preview without importing")
		fmt.Println("💡 Tip: Use --max-file-size to adjust size limit")
		fmt.Println("─────────────────────────────────────────")
	}

	fmt.Println()

	return nil
}

// promptConfirmation prompts the user for yes/no confirmation
func promptConfirmation(prompt string) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s (y/n): ", prompt)
	input, err := reader.ReadString('\n')
	if err != nil {
		return false
	}

	input = strings.TrimSpace(strings.ToLower(input))
	return input == "y" || input == "yes"
}

// performImport executes the actual import operation
func performImport(config *ImportConfig, fileIndex []FileIndex, client *SupabaseClient) error {
	progress := &ImportProgress{
		Total:     len(fileIndex),
		StartTime: time.Now(),
	}

	// Track folder hierarchy for parent-child relationships
	folderMap := make(map[string]string) // map[relative_path]content_id

	// Sort fileIndex to process directories before files at each level
	sortFileIndexForImport(fileIndex)

	for i, file := range fileIndex {
		progress.CurrentFile = file.RelativePath
		progress.Processed = i + 1

		if config.Verbose {
			fmt.Printf("[%d/%d] Processing: %s\n", progress.Processed, progress.Total, file.RelativePath)
		} else {
			printProgress(progress)
		}

		// Determine parent content ID
		var parentID *string
		if file.RelativePath != "." {
			parentPath := filepath.Dir(file.RelativePath)
			if parentPath != "." {
				if id, exists := folderMap[parentPath]; exists {
					parentID = &id
				}
			}
		}

		// Create content insert
		var contentInsert ContentInsert
		if file.IsDir {
			// Create folder content item
			contentInsert = ContentInsert{
				Type:            "folder",
				Data:            filepath.Base(file.Path),
				UserID:          config.UserID,
				GroupID:         config.GroupID,
				ParentContentID: parentID,
				Metadata: map[string]interface{}{
					"original_path": file.RelativePath,
					"created_at":    file.ModTime.Format(time.RFC3339),
					"import_source": "cli_import",
				},
			}
		} else {
			// Determine content type from mapping
			contentType := config.TypeMappings[file.Extension]
			if contentType == "" {
				contentType = "text"
			}

			// Read file content
			fileContent, err := readFileContent(file.Path, config.MaxFileSize)
			if err != nil {
				progress.Failed++
				progress.Errors = append(progress.Errors, ImportError{
					FilePath: file.RelativePath,
					Error:    err,
				})
				continue
			}

			// Create file content item
			contentInsert = ContentInsert{
				Type:            contentType,
				Data:            fileContent,
				UserID:          config.UserID,
				GroupID:         config.GroupID,
				ParentContentID: parentID,
				Metadata: map[string]interface{}{
					"original_path": file.RelativePath,
					"file_name":     filepath.Base(file.Path),
					"file_size":     file.Size,
					"file_ext":      file.Extension,
					"mime_type":     file.MimeType,
					"modified_at":   file.ModTime.Format(time.RFC3339),
					"import_source": "cli_import",
				},
			}
		}

		// Insert into Supabase
		response, err := client.InsertContent(contentInsert)
		if err != nil {
			progress.Failed++
			progress.Errors = append(progress.Errors, ImportError{
				FilePath: file.RelativePath,
				Error:    err,
			})
			continue
		}

		// Track folder content IDs for hierarchy
		if file.IsDir {
			folderMap[file.RelativePath] = response.ID
		}

		progress.Succeeded++
	}

	// Print final summary
	fmt.Println()
	printImportSummary(progress)

	return nil
}

// sortFileIndexForImport sorts the file index to ensure directories are processed before their contents
func sortFileIndexForImport(fileIndex []FileIndex) {
	sort.Slice(fileIndex, func(i, j int) bool {
		// First, sort by directory depth (shallower first)
		depthI := strings.Count(fileIndex[i].RelativePath, string(filepath.Separator))
		depthJ := strings.Count(fileIndex[j].RelativePath, string(filepath.Separator))
		if depthI != depthJ {
			return depthI < depthJ
		}

		// Then, directories before files at the same level
		if fileIndex[i].IsDir != fileIndex[j].IsDir {
			return fileIndex[i].IsDir
		}

		// Finally, alphabetically
		return fileIndex[i].RelativePath < fileIndex[j].RelativePath
	})
}

// readFileContent reads the content of a file
func readFileContent(path string, maxSize int64) (string, error) {
	// Check file size
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}

	if info.Size() > maxSize {
		return "", fmt.Errorf("file too large: %d bytes (max: %d bytes)", info.Size(), maxSize)
	}

	// Read file content
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

// printProgress prints a progress bar
func printProgress(progress *ImportProgress) {
	percentage := float64(progress.Processed) / float64(progress.Total) * 100
	barWidth := 40
	filled := int(float64(barWidth) * percentage / 100)

	bar := strings.Repeat("=", filled)
	if filled < barWidth {
		bar += ">"
		bar += strings.Repeat(" ", barWidth-filled-1)
	}

	fmt.Printf("\r[%s] %d/%d (%.1f%%) - %d errors",
		bar, progress.Processed, progress.Total, percentage, progress.Failed)
}

// printImportSummary prints a summary of the import operation
func printImportSummary(progress *ImportProgress) {
	duration := time.Since(progress.StartTime)

	fmt.Println("─────────────────────────────────────────")
	fmt.Println("Import Complete!")
	fmt.Println("─────────────────────────────────────────")
	fmt.Printf("✅ Succeeded: %d\n", progress.Succeeded)
	fmt.Printf("❌ Failed:    %d\n", progress.Failed)
	fmt.Printf("📊 Total:     %d\n", progress.Total)
	fmt.Printf("⏱️  Duration:  %s\n", duration.Round(time.Millisecond))
	fmt.Println("─────────────────────────────────────────")

	if len(progress.Errors) > 0 {
		fmt.Println("\nErrors:")
		for _, e := range progress.Errors {
			fmt.Printf("  ❌ %s: %s\n", e.FilePath, e.Error)
		}
	}
}
