#!/bin/bash

# Setup script for Caption Parser testing
# This script helps you set up the environment for testing the caption parser

set -e

echo "🧪 Setting up Caption Parser Test Environment"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the caption-parser directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.test .env
    echo "📝 Please edit .env file and add your OPENROUTER_API_KEY"
    echo ""
    echo "To get an OpenRouter API key:"
    echo "1. Go to https://openrouter.ai/"
    echo "2. Sign up for an account"
    echo "3. Go to Keys section"
    echo "4. Create a new API key"
    echo "5. Add it to the .env file as OPENROUTER_API_KEY=your_key_here"
    echo ""
    read -p "Press Enter when you've added your API key to .env file..."
else
    echo "✅ .env file already exists"
fi

# Check if API key is set
if [ -f ".env" ]; then
    if grep -q "OPENROUTER_API_KEY=your_openrouter_api_key_here" .env; then
        echo "⚠️  Warning: Please update your OPENROUTER_API_KEY in .env file"
        echo "Current .env file still contains placeholder value"
    elif grep -q "OPENROUTER_API_KEY=" .env; then
        echo "✅ OPENROUTER_API_KEY is set in .env file"
    else
        echo "⚠️  Warning: OPENROUTER_API_KEY not found in .env file"
    fi
fi

# Compile TypeScript to check for errors
echo "🔍 Checking TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed. Please fix the errors above."
    exit 1
fi

echo ""
echo "🎉 Setup complete! You can now run the caption parser test:"
echo ""
echo "   npm run test:captions"
echo ""
echo "Or run with ts-node directly:"
echo ""
echo "   npx ts-node test-caption-parser.ts"
echo ""
echo "📊 The test will run through realistic TikTok captions and show:"
echo "   • Parsing success rate"
echo "   • Processing times"
echo "   • Price detection accuracy"
echo "   • Title extraction quality"
echo "   • Category classification"
echo ""
echo "Happy testing! 🚀"
