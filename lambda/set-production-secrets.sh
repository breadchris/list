#!/bin/bash

# Script to set production API keys in Pulumi for Lambda deployment
# These secrets are needed for the Lambda function to work properly

set -e

cd "$(dirname "$0")"

echo "=================================================="
echo "Setting Production Secrets for Lambda Deployment"
echo "=================================================="
echo ""
echo "You'll need to provide API keys from the following services:"
echo "1. OpenAI - https://platform.openai.com/api-keys"
echo "2. Cloudflare - https://dash.cloudflare.com/profile/api-tokens"
echo "3. TMDb - https://www.themoviedb.org/settings/api"
echo ""
echo "These secrets are currently set in your Supabase Edge Function."
echo "You can find them in your Supabase dashboard under:"
echo "Project Settings > Edge Functions > Secrets"
echo ""

# Set Pulumi passphrase
export PULUMI_CONFIG_PASSPHRASE=""

# Function to securely read input
read_secret() {
    local prompt="$1"
    local value
    echo -n "$prompt"
    read -s value
    echo ""
    echo "$value"
}

# Check current configuration
echo "Current Pulumi configuration:"
pulumi config 2>&1 | grep -E "(openai|cloudflare|tmdb)" || echo "No content API secrets configured yet"
echo ""

# Prompt for each secret
echo "Please provide the following API keys:"
echo "(Press Ctrl+C to cancel at any time)"
echo ""

# OpenAI API Key
echo "1. OpenAI API Key"
echo "   Get from: https://platform.openai.com/api-keys"
echo "   Should start with: sk-proj-..."
OPENAI_KEY=$(read_secret "   Enter OpenAI API Key: ")
if [ -z "$OPENAI_KEY" ]; then
    echo "   ⚠️  Empty key provided, skipping"
else
    pulumi config set --secret openai_api_key "$OPENAI_KEY"
    echo "   ✓ OpenAI API key configured"
fi
echo ""

# Cloudflare API Key
echo "2. Cloudflare API Token"
echo "   Get from: https://dash.cloudflare.com/profile/api-tokens"
echo "   Required permissions: Browser Rendering"
CLOUDFLARE_KEY=$(read_secret "   Enter Cloudflare API Token: ")
if [ -z "$CLOUDFLARE_KEY" ]; then
    echo "   ⚠️  Empty token provided, skipping"
else
    pulumi config set --secret cloudflare_api_key "$CLOUDFLARE_KEY"
    echo "   ✓ Cloudflare API token configured"
fi
echo ""

# Cloudflare Account ID
echo "3. Cloudflare Account ID"
echo "   Get from: Cloudflare dashboard (right sidebar)"
read -p "   Enter Cloudflare Account ID: " CLOUDFLARE_ACCOUNT
if [ -z "$CLOUDFLARE_ACCOUNT" ]; then
    echo "   ⚠️  Empty account ID provided, skipping"
else
    pulumi config set cloudflare_account_id "$CLOUDFLARE_ACCOUNT"
    echo "   ✓ Cloudflare account ID configured"
fi
echo ""

# TMDb API Key
echo "4. TMDb API Read Access Token (Bearer Token)"
echo "   Get from: https://www.themoviedb.org/settings/api"
echo "   Use the 'API Read Access Token', NOT the API Key"
TMDB_KEY=$(read_secret "   Enter TMDb Bearer Token: ")
if [ -z "$TMDB_KEY" ]; then
    echo "   ⚠️  Empty token provided, skipping"
else
    pulumi config set --secret tmdb_api_key "$TMDB_KEY"
    echo "   ✓ TMDb API token configured"
fi
echo ""

echo "=================================================="
echo "Configuration Summary"
echo "=================================================="
pulumi config
echo ""

# Ask if user wants to deploy
echo "Would you like to deploy these changes to Lambda now? (y/n)"
read -p "> " DEPLOY

if [ "$DEPLOY" = "y" ] || [ "$DEPLOY" = "Y" ]; then
    echo ""
    echo "Deploying Lambda with updated secrets..."
    pulumi up --yes
    echo ""
    echo "✓ Deployment complete!"
else
    echo ""
    echo "Configuration saved. Run 'pulumi up' to deploy when ready."
fi
