#!/bin/bash
# Upload Cooking Wiki - Batch upload markdown files to wiki
#
# Usage:
#   ./scripts/upload-cooking-wiki.sh <wiki-doc-id>
#
# Example:
#   ./scripts/upload-cooking-wiki.sh wiki-dee2d06f-d2cf-49b4-8443-78272f58a206

set -e

DOC_ID="${1:-}"
SOURCE_DIR="${2:-../data/cooking}"
PREFIX="${3:-notes}"

if [ -z "$DOC_ID" ]; then
    echo "Usage: $0 <wiki-doc-id> [source-dir] [prefix]"
    echo "Example: $0 wiki-dee2d06f-d2cf-49b4-8443-78272f58a206"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Uploading cooking wiki to $DOC_ID"
echo "Source: $SOURCE_DIR"
echo "Prefix: $PREFIX/"
echo ""

# Find all markdown files
FILES=$(find "$SOURCE_DIR" -name "*.md" -type f | sort)
TOTAL=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Found $TOTAL markdown files"
echo ""

SUCCESS=0
FAILED=0
COUNT=0

for FILE in $FILES; do
    COUNT=$((COUNT + 1))

    # Get relative path from source dir
    REL_PATH="${FILE#$SOURCE_DIR/}"

    # Remove .md extension
    WIKI_PATH="${REL_PATH%.md}"

    # Handle CLAUDE.md as index pages
    if [[ "$WIKI_PATH" == */CLAUDE ]]; then
        WIKI_PATH="${WIKI_PATH%/CLAUDE}"
    elif [[ "$WIKI_PATH" == "CLAUDE" ]]; then
        WIKI_PATH=""
    fi

    # Add prefix
    if [ -n "$WIKI_PATH" ]; then
        WIKI_PATH="$PREFIX/$WIKI_PATH"
    else
        WIKI_PATH="$PREFIX"
    fi

    echo "[$COUNT/$TOTAL] $WIKI_PATH"

    # Read file content
    CONTENT=$(cat "$FILE")

    # Create page (timeout 60s)
    if timeout 60 npx tsx scripts/wiki-cli.ts create-page --path "$WIKI_PATH" --docId "$DOC_ID" > /dev/null 2>&1; then
        # Set content (timeout 60s)
        if echo "$CONTENT" | timeout 60 npx tsx scripts/wiki-cli.ts set-page-markdown --path "$WIKI_PATH" --markdown "$(cat)" --docId "$DOC_ID" > /dev/null 2>&1; then
            SUCCESS=$((SUCCESS + 1))
        else
            echo "  FAILED to set content"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  FAILED to create page"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "Upload complete!"
echo "  Success: $SUCCESS"
echo "  Failed: $FAILED"
