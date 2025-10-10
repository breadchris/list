#!/bin/bash

# Script to configure Pulumi secrets for Lambda deployment
# Run this script after obtaining all API keys

set -e

cd "$(dirname "$0")"

echo "Configuring Pulumi secrets for Lambda deployment..."
echo ""

# Check if secrets are already set
echo "Current Pulumi configuration:"
pulumi config
echo ""

# Prompt for secrets that are not already set
echo "Please provide the following API keys:"
echo ""

# OpenAI API Key
if pulumi config get openai_api_key > /dev/null 2>&1; then
    echo "✓ OpenAI API key already configured"
else
    echo "Enter OpenAI API key (from https://platform.openai.com/api-keys):"
    read -s OPENAI_API_KEY
    pulumi config set --secret openai_api_key "$OPENAI_API_KEY"
    echo "✓ OpenAI API key configured"
fi
echo ""

# Cloudflare API Key
if pulumi config get cloudflare_api_key > /dev/null 2>&1; then
    echo "✓ Cloudflare API key already configured"
else
    echo "Enter Cloudflare API token (from https://dash.cloudflare.com/profile/api-tokens):"
    read -s CLOUDFLARE_API_KEY
    pulumi config set --secret cloudflare_api_key "$CLOUDFLARE_API_KEY"
    echo "✓ Cloudflare API key configured"
fi
echo ""

# Cloudflare Account ID
if pulumi config get cloudflare_account_id > /dev/null 2>&1; then
    echo "✓ Cloudflare account ID already configured"
else
    echo "Enter Cloudflare Account ID (from Cloudflare dashboard):"
    read CLOUDFLARE_ACCOUNT_ID
    pulumi config set cloudflare_account_id "$CLOUDFLARE_ACCOUNT_ID"
    echo "✓ Cloudflare account ID configured"
fi
echo ""

# TMDb API Key
if pulumi config get tmdb_api_key > /dev/null 2>&1; then
    echo "✓ TMDb API key already configured"
else
    echo "Enter TMDb API Read Access Token (from https://www.themoviedb.org/settings/api):"
    read -s TMDB_API_KEY
    pulumi config set --secret tmdb_api_key "$TMDB_API_KEY"
    echo "✓ TMDb API key configured"
fi
echo ""

echo "All secrets configured successfully!"
echo ""
echo "Final configuration:"
pulumi config
echo ""
echo "You can now run 'pulumi up' to deploy the Lambda function."
