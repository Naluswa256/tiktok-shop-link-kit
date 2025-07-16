#!/bin/bash

# Build script for scheduled ingestion Lambda function
# This script compiles the NestJS application and packages it for AWS Lambda

set -e

echo "🏗️  Building scheduled ingestion Lambda function..."

# Configuration
LAMBDA_NAME="scheduled-ingestion"
BUILD_DIR="dist/lambda"
LAMBDA_DIR="$BUILD_DIR/$LAMBDA_NAME"
ZIP_FILE="$LAMBDA_NAME.zip"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf $BUILD_DIR
rm -f $ZIP_FILE

# Create build directory
mkdir -p $LAMBDA_DIR

# Build the NestJS application
echo "📦 Building NestJS application..."
npm run build

# Copy built files
echo "📋 Copying built files..."
cp -r dist/* $LAMBDA_DIR/
cp package.json $LAMBDA_DIR/
cp package-lock.json $LAMBDA_DIR/

# Install production dependencies
echo "📥 Installing production dependencies..."
cd $LAMBDA_DIR
npm ci --only=production --silent

# Create Lambda entry point
echo "🎯 Creating Lambda entry point..."
cat > index.js << 'EOF'
const { handler } = require('./ingestion/handlers/scheduled-ingestion.handler');

exports.handler = handler;
EOF

# Remove unnecessary files to reduce package size
echo "🗑️  Removing unnecessary files..."
find . -name "*.ts" -type f -delete
find . -name "*.map" -type f -delete
find . -name "*.md" -type f -delete
find . -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.test.js" -type f -delete
find . -name "*.spec.js" -type f -delete

# Create ZIP package
echo "📦 Creating ZIP package..."
cd ..
zip -r $ZIP_FILE $LAMBDA_NAME/ -q

# Move ZIP to project root
mv $ZIP_FILE ../../

# Get package size
PACKAGE_SIZE=$(du -h ../../$ZIP_FILE | cut -f1)

echo "✅ Lambda package created successfully!"
echo "📦 Package: $ZIP_FILE"
echo "📏 Size: $PACKAGE_SIZE"
echo ""
echo "🚀 Ready to deploy with Terraform!"
echo ""
echo "Next steps:"
echo "1. Set your Apify token: export TF_VAR_apify_token='your-token-here'"
echo "2. Run: terraform plan"
echo "3. Run: terraform apply"
