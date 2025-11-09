#!/bin/bash
# Load secrets from Pulumi for local testing
# Usage: source load-pulumi-secrets.sh

set -e

# Navigate to lambda directory (parent of function/)
cd "$(dirname "$0")/.."

export PULUMI_CONFIG_PASSPHRASE=""

echo "Loading secrets from Pulumi..."

export ANTHROPIC_API_KEY=$(pulumi config get anthropic_api_key)
export SUPABASE_SERVICE_ROLE_KEY=$(pulumi config get supabase_service_role_key)
export SUPABASE_URL=$(pulumi config get supabase_url)
export OPENAI_API_KEY=$(pulumi config get openai_api_key)
export CLOUDFLARE_API_KEY=$(pulumi config get cloudflare_api_key)
export CLOUDFLARE_ACCOUNT_ID=$(pulumi config get cloudflare_account_id)
export TMDB_API_KEY=$(pulumi config get tmdb_api_key)
export DEEPGRAM_API_KEY=$(pulumi config get deepgram_api_key)
export MAPKIT_TEAM_ID=$(pulumi config get mapkit_team_id)
export MAPKIT_KEY_ID=$(pulumi config get mapkit_key_id)
export MAPKIT_PRIVATE_KEY=$(pulumi config get mapkit_private_key)

echo "✓ Secrets loaded successfully"
echo ""
echo "Environment variables set:"
echo "  - ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:20}..."
echo "  - SUPABASE_URL: $SUPABASE_URL"
echo "  - SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo "  - OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."
echo "  - CLOUDFLARE_ACCOUNT_ID: $CLOUDFLARE_ACCOUNT_ID"
echo "  - CLOUDFLARE_API_KEY: ${CLOUDFLARE_API_KEY:0:20}..."
echo "  - TMDB_API_KEY: ${TMDB_API_KEY:0:20}..."
echo "  - DEEPGRAM_API_KEY: ${DEEPGRAM_API_KEY:0:20}..."
echo "  - MAPKIT_TEAM_ID: $MAPKIT_TEAM_ID"
echo "  - MAPKIT_KEY_ID: $MAPKIT_KEY_ID"
echo "  - MAPKIT_PRIVATE_KEY: ${MAPKIT_PRIVATE_KEY:0:50}..."
echo ""
echo "Ready to run Docker tests!"
