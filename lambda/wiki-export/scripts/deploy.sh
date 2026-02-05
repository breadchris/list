#!/bin/bash
# Build and deploy wiki-export Lambda
set -e

cd "$(dirname "$0")/.."

BUCKET="claude-code-lambda-deployment"
KEY="wiki-export/function.zip"
FUNCTION_NAME="wiki-export-lambda"
REGION="us-east-1"

echo "=== Building wiki-export Lambda ==="

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Create staging directory
echo "Creating deployment package..."
rm -rf .zip-staging
mkdir -p .zip-staging

# Copy bundle and required files
cp dist/index.cjs .zip-staging/
# Copy xhr-sync-worker.js if it exists (required by jsdom)
if [ -f "dist/xhr-sync-worker.js" ]; then
  cp dist/xhr-sync-worker.js .zip-staging/
fi

# Copy package.json for runtime
cp package.json .zip-staging/

# Install production dependencies in staging
cd .zip-staging
npm install --omit=dev --ignore-scripts 2>/dev/null || true
cd ..

# Create ZIP
rm -f function.zip
cd .zip-staging
zip -rq ../function.zip .
cd ..

# Cleanup staging
rm -rf .zip-staging

ZIP_SIZE=$(du -h function.zip | cut -f1)
echo "Created function.zip ($ZIP_SIZE)"

# Check if S3 bucket exists, create if not
echo "=== Uploading to S3 ==="
if ! aws s3 ls "s3://${BUCKET}" 2>/dev/null; then
  echo "Creating S3 bucket: ${BUCKET}"
  aws s3 mb "s3://${BUCKET}" --region ${REGION}
fi

# Upload to S3
aws s3 cp function.zip "s3://${BUCKET}/${KEY}" --region ${REGION}
echo "Uploaded to s3://${BUCKET}/${KEY}"

# Check if Lambda exists
echo "=== Updating Lambda ==="
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} 2>/dev/null; then
  # Update existing Lambda
  aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --s3-bucket ${BUCKET} \
    --s3-key ${KEY} \
    --region ${REGION} \
    --output text --query 'FunctionArn'
  echo "Lambda updated: ${FUNCTION_NAME}"
else
  echo "Lambda ${FUNCTION_NAME} does not exist. Run 'pulumi up' in lambda/ first to create infrastructure."
  exit 1
fi

# Cleanup
rm -f function.zip

echo "=== Done ==="
