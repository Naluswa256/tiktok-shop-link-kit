#!/bin/bash

# Build and test script for Caption Parser Worker

set -e

echo "🏗️  Building Caption Parser Worker..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"

# Run tests if requested
if [ "$1" = "test" ]; then
    echo ""
    echo "🧪 Running tests..."
    
    # Check if we have the required environment variables
    if [ -z "$LLM_PROVIDER" ]; then
        echo "Setting default LLM_PROVIDER=ollama"
        export LLM_PROVIDER=ollama
    fi
    
    if [ -z "$LLM_MODEL" ]; then
        echo "Setting default LLM_MODEL=phi3:mini"
        export LLM_MODEL=phi3:mini
    fi
    
    # Run the flexible parsing test
    node test-flexible-parsing.js
fi

echo ""
echo "🎉 Caption Parser Worker is ready!"
echo ""
echo "Next steps:"
echo "1. Set environment variables (see .env.example)"
echo "2. Test with: npm run test or node test-flexible-parsing.js"
echo "3. Deploy with: zip -r caption-parser.zip dist/ node_modules/ package.json"
