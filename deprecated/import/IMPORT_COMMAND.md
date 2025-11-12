# Import Command Documentation

## Overview

The `import` command allows you to bulk import files and folders from your local filesystem into the JustShare (List) app. The command preserves the folder hierarchy by creating parent-child content relationships in Supabase.

## Basic Usage

```bash
go run . import <directory> --user-id <user-uuid> [flags]
```

## Quick Start Example

```bash
# Interactive import with prompts
go run . import ./my-documents --user-id "abc-123-def-456"

# Non-interactive with all options specified
go run . import ./my-documents \
  --user-id "abc-123-def-456" \
  --group-id "xyz-789-ghi-012" \
  --max-file-size 5 \
  --verbose
```

## Command Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--user-id` | string | *required* | User ID for content ownership |
| `--group-id` | string | *interactive* | Group ID for content (will prompt if not provided) |
| `--skip-hidden` | bool | `true` | Skip hidden files and directories (those starting with `.`) |
| `--max-file-size` | int | `10` | Maximum file size in MB |
| `--dry-run` | bool | `false` | Preview import without making changes |
| `--verbose` | bool | `false` | Show detailed progress output |

## Interactive Workflow

When you run the import command without specifying all options, it will guide you through an interactive setup:

### Step 1: Directory Scanning

The command scans the specified directory and displays statistics:

```
🔍 Scanning directory: ./my-documents
Found 65 files and 3 folders

File Types Found:
  .txt (45 files, 2.3 MB)
  .md (12 files, 450 KB)
  .jpg (8 files, 15 MB)
```

### Step 2: File Type Selection

You can choose which file types to import:

```
Select file types to import (comma-separated, e.g., .txt,.md or 'all'): txt,md
```

Options:
- Enter comma-separated extensions: `.txt,.md,.jpg`
- Enter extensions without dots: `txt,md,jpg`
- Enter `all` to import all file types

### Step 3: Content Type Mapping

For each selected file type, you can map it to a content type:

```
Content Type Mapping:
Press Enter to use default mapping, or type a custom content type

  .txt → text (default) [Enter to confirm or type new]:
  .md → text (default) [Enter to confirm or type new]:
```

Default mappings:
- **Text**: `.txt`, `.md`, `.json`, `.js`, `.ts`, `.html`, `.css`, `.py`, `.go`, etc.
- **Image**: `.jpg`, `.png`, `.gif`, `.webp`, `.svg`
- **Video**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`
- **Audio**: `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`
- **Document**: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`
- **Archive**: `.zip`, `.tar`, `.gz`, `.7z`, `.rar`

### Step 4: Group Selection

If `--group-id` is not provided, you'll be prompted to select a group:

```
Available groups:
  1) Personal Notes (abc-123-def)
  2) Work Documents (ghi-456-jkl)

Select group (number or UUID): 1
```

You can either:
- Enter a number (1, 2, etc.)
- Enter a group UUID directly

### Step 5: Import Summary & Confirmation

Before importing, you'll see a summary and confirmation prompt:

```
─────────────────────────────────────────
Import Summary
─────────────────────────────────────────
Directory:     ./my-documents
Total files:   57
Folders:       3
Total size:    15.2 MB
File types:    .txt, .md
Target group:  Personal Notes (abc-123)
User ID:       def-456-abc
Max file size: 10.0 MB
Skip hidden:   true
─────────────────────────────────────────

Continue with import? (y/n): y
```

#### With Warnings

If your import has potential issues, you'll see warnings:

```
─────────────────────────────────────────
Import Summary
─────────────────────────────────────────
Directory:     ./large-project
Total files:   1250
Folders:       45
Total size:    250.5 MB
File types:    .txt, .md, .jpg
Target group:  My Files (abc-123)
User ID:       def-456-abc
Max file size: 10.0 MB
Skip hidden:   true
─────────────────────────────────────────

⚠️  WARNINGS:
    ⚠️  Large import: 1250 files (may take several minutes)
    ⚠️  Large total size: 250.5 MB (may take a while to upload)
    ⚠️  12 files larger than 5 MB detected
    ⚠️  3 files near size limit (10.0 MB)

Largest files:
    • photos/vacation.jpg (9.8 MB)
    • videos/demo.mp4 (9.5 MB)
    • archive/backup.zip (8.2 MB)
    • images/high-res.png (7.1 MB)
    • documents/report.pdf (6.5 MB)
    ... and 7 more large files

💡 Tip: Use --dry-run to preview without importing
💡 Tip: Use --max-file-size to adjust size limit
─────────────────────────────────────────

Continue with import? (y/n):
```

### Step 6: Import Progress

During import, you'll see a progress bar:

```
📤 Starting import...

[====================>] 57/57 (100.0%) - 0 errors
```

With `--verbose`, you'll see each file being processed:

```
[1/57] Processing: notes/readme.md
[2/57] Processing: notes/todo.txt
[3/57] Processing: projects/website/index.html
...
```

### Step 7: Completion Summary

After import completes:

```
─────────────────────────────────────────
Import Complete!
─────────────────────────────────────────
✅ Succeeded: 57
❌ Failed:    0
📊 Total:     57
⏱️  Duration:  12.3s
─────────────────────────────────────────
```

If there were errors:

```
Errors:
  ❌ large-file.mp4: file too large: 52428800 bytes (max: 10485760 bytes)
  ❌ corrupted.txt: failed to read file: permission denied
```

## How It Works

### Folder Hierarchy

The import command preserves your directory structure using Supabase's `parent_content_id` field:

```
my-documents/
├── notes/
│   ├── readme.md
│   └── todo.txt
└── projects/
    └── website/
        └── index.html
```

Becomes:

```
Content Table:
┌─────────────────────┬──────────┬───────────────┬──────────────────────┐
│ id                  │ type     │ data          │ parent_content_id    │
├─────────────────────┼──────────┼───────────────┼──────────────────────┤
│ folder-001          │ folder   │ notes         │ NULL                 │
│ folder-002          │ folder   │ projects      │ NULL                 │
│ folder-003          │ folder   │ website       │ folder-002           │
│ content-001         │ text     │ (readme.md)   │ folder-001           │
│ content-002         │ text     │ (todo.txt)    │ folder-001           │
│ content-003         │ text     │ (index.html)  │ folder-003           │
└─────────────────────┴──────────┴───────────────┴──────────────────────┘
```

### Content Structure

For each file, the following data is stored:

**Folder:**
```json
{
  "type": "folder",
  "data": "notes",
  "user_id": "abc-123",
  "group_id": "def-456",
  "parent_content_id": null,
  "metadata": {
    "original_path": "notes",
    "created_at": "2025-01-15T10:30:00Z",
    "import_source": "cli_import"
  }
}
```

**File:**
```json
{
  "type": "text",
  "data": "# README\n\nThis is my readme file...",
  "user_id": "abc-123",
  "group_id": "def-456",
  "parent_content_id": "folder-001",
  "metadata": {
    "original_path": "notes/readme.md",
    "file_name": "readme.md",
    "file_size": 1024,
    "file_ext": ".md",
    "mime_type": "text/markdown",
    "modified_at": "2025-01-15T10:30:00Z",
    "import_source": "cli_import"
  }
}
```

## Warning System

The import command includes a comprehensive warning system to help you make informed decisions before importing:

### Warning Types

1. **Large Import Warning** (> 1000 files)
   - Alerts you that the import may take several minutes
   - Suggests breaking into smaller batches
   - For very large imports (> 5000 files), requires explicit confirmation

2. **Medium Import Notice** (> 500 files)
   - Informs you the import may take a few minutes
   - No confirmation required, just informational

3. **Large Total Size Warning** (> 100 MB)
   - Indicates the upload may take a while
   - Helps estimate time requirements

4. **Individual Large Files** (> 5 MB)
   - Shows count of files larger than 5 MB
   - Lists the top 5 largest files with sizes
   - Helps identify potential issues

5. **Files Near Size Limit** (> 80% of max)
   - Warns about files approaching the size limit
   - Suggests adjusting `--max-file-size` if needed

6. **Skipped Files**
   - Shows files excluded due to size limit
   - Lists up to 10 skipped files with their sizes
   - Provides tip to increase limit if needed

7. **Skipped Hidden Files**
   - Reports count of hidden files/folders skipped
   - Reminds about `--skip-hidden=false` option

### Early Warning Example

For very large imports, you'll get an early warning during scanning:

```bash
🔍 Scanning directory: ./massive-project
Found 5500 files and 120 folders

⚠️  WARNING: This is a very large import (5500 files)
This may take a significant amount of time and could hit rate limits.
Consider breaking this into smaller batches or using --dry-run first.

Continue with scan? (y/n):
```

### Skipped Files Example

When files exceed the size limit:

```bash
⚠️  Skipped 3 files exceeding size limit (10.0 MB):
    • videos/presentation.mp4 (45.2 MB)
    • images/high-res-scan.tiff (32.8 MB)
    • backups/archive.zip (15.5 MB)

💡 Tip: Use --max-file-size to increase the limit
```

## Advanced Usage

### Dry Run Mode

Preview what would be imported without making changes:

```bash
go run . import ./my-documents --user-id <uuid> --dry-run
```

Output:
```
🔍 DRY RUN MODE - No changes will be made

Files that would be imported:
  notes/readme.md (1.0 KB)
  notes/todo.txt (512 B)
  projects/website/index.html (2.5 KB)
```

### Custom File Size Limit

Limit imported files to 5 MB:

```bash
go run . import ./my-documents --user-id <uuid> --max-file-size 5
```

### Include Hidden Files

Import hidden files and directories:

```bash
go run . import ./my-documents --user-id <uuid> --skip-hidden=false
```

### Verbose Output

See detailed progress for each file:

```bash
go run . import ./my-documents --user-id <uuid> --verbose
```

## Use Cases

### 1. Importing Documentation

```bash
# Import all markdown and text files from a docs folder
go run . import ./docs --user-id <uuid>
# Select: md,txt
# Map: .md → text, .txt → text
```

### 2. Importing a Photo Library

```bash
# Import photos with larger size limit
go run . import ./photos --user-id <uuid> --max-file-size 50
# Select: jpg,png,gif
# Map: .jpg → image, .png → image, .gif → image
```

### 3. Importing Code Projects

```bash
# Import source code files (skip node_modules, .git, etc.)
go run . import ./my-project --user-id <uuid> --skip-hidden
# Select: js,ts,jsx,tsx,css,html
# Map: .js → text, .ts → text, .css → text, etc.
```

### 4. Importing Mixed Content

```bash
# Import all file types
go run . import ./mixed-content --user-id <uuid>
# Select: all
```

## Limitations

1. **File Size**: Default maximum 10 MB per file (configurable with `--max-file-size`)
2. **Binary Files**: Large binary files (videos, images) are stored as text in the `data` field - consider using Supabase Storage for large files
3. **File Content**: All file content is stored in the `data` field as text - binary files may not import correctly
4. **Metadata Only**: For binary files, consider storing just metadata and keeping files in external storage
5. **Rate Limiting**: Large imports may hit Supabase rate limits - the command handles errors gracefully

## Error Handling

The import command handles errors gracefully:

- **File Read Errors**: Logs error, continues with next file
- **Network Errors**: Logs error, continues with next file
- **Supabase Errors**: Logs error with response details
- **Permission Errors**: Logs error, skips file

All errors are collected and displayed in the final summary.

## Best Practices

1. **Start with Dry Run**: Always test with `--dry-run` first to preview changes
2. **Small Batches**: Import large directories in smaller batches
3. **Use Appropriate Size Limits**: Set `--max-file-size` based on your file types
4. **Skip Hidden Files**: Use `--skip-hidden` to avoid importing system files
5. **Monitor Progress**: Use `--verbose` for large imports to track progress
6. **Check Errors**: Review error summary after import to identify issues

## Troubleshooting

### "User is not a member of any groups"

Create a group first or join an existing group before importing.

### "File too large" errors

Increase `--max-file-size` or exclude large files:

```bash
go run . import ./my-docs --user-id <uuid> --max-file-size 50
```

### "Permission denied" errors

Ensure you have read permissions for all files in the directory.

### "No files found in directory"

Check that:
- The directory path is correct
- Files exist in the directory
- You're not skipping all files with `--skip-hidden`

## Technical Details

### Database Schema

The import command uses the existing `content` table:

```sql
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL DEFAULT 'text',
  data TEXT NOT NULL,
  metadata JSONB,
  user_id UUID NOT NULL REFERENCES users(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  parent_content_id UUID REFERENCES content(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Calls

The command makes the following Supabase REST API calls:

1. **Get Group Memberships**: `GET /rest/v1/group_memberships?user_id=eq.{uuid}&select=group_id,groups(id,name)`
2. **Get Group**: `GET /rest/v1/groups?id=eq.{uuid}&select=id,name`
3. **Insert Content**: `POST /rest/v1/content` (for each file/folder)

### File Processing Order

Files are processed in the following order to ensure parent folders exist before child content:

1. Sort by directory depth (shallow to deep)
2. Directories before files at the same level
3. Alphabetically within the same level

## Future Enhancements

Potential improvements for future versions:

- **Parallel Uploads**: Import multiple files concurrently
- **Resume Support**: Continue failed imports from where they stopped
- **File Deduplication**: Skip files that already exist
- **Storage Integration**: Upload binary files to Supabase Storage
- **Progress File**: Save import state to resume later
- **Filter Patterns**: Include/exclude files by glob patterns
- **Tag Support**: Auto-tag imported content
- **Metadata Extraction**: Extract and store rich metadata (EXIF, ID3, etc.)

## Examples

### Example 1: Simple Markdown Documentation

```bash
$ go run . import ./docs --user-id "550e8400-e29b-41d4-a716-446655440000"

🔍 Scanning directory: ./docs
Found 12 files and 2 folders

File Types Found:
  .md (10 files, 125 KB)
  .png (2 files, 450 KB)

Select file types to import (comma-separated or 'all'): md

Content Type Mapping:
  .md → text (default) [Enter to confirm or type new]:

Available groups:
  1) Documentation (abc-123)
  2) Personal (def-456)

Select group (1-2 or enter UUID): 1

─────────────────────────────────────────
Import Summary
─────────────────────────────────────────
Directory:    ./docs
Total files:  10
Folders:      2
File types:   .md
Target group: Documentation (abc-123)
─────────────────────────────────────────

Continue with import? (y/n): y

📤 Starting import...
[====================>] 12/12 (100.0%) - 0 errors

─────────────────────────────────────────
Import Complete!
─────────────────────────────────────────
✅ Succeeded: 12
❌ Failed:    0
📊 Total:     12
⏱️  Duration:  2.1s
─────────────────────────────────────────
```

## Support

For issues or questions:
- Check the troubleshooting section above
- Review error messages in the import summary
- Ensure Supabase configuration is correct in `config.json`
- Verify network connectivity to Supabase

## Related Commands

- `go run . serve` - Start the development server
- `go run . build` - Build the application
- `go run . run types` - Generate TypeScript types from database schema
