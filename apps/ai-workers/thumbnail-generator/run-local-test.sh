#!/bin/bash

# Local Thumbnail Generator Test Runner
# This script sets up and runs the thumbnail generator locally

set -e

echo "🖼️  Thumbnail Generator - Local Testing Setup"
echo "=============================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg is not installed. Installing via package manager..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    else
        echo "❌ Please install ffmpeg manually: https://ffmpeg.org/download.html"
        exit 1
    fi
fi

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    echo "⚠️  yt-dlp is not installed. Installing via pip..."
    pip3 install yt-dlp
fi

echo "✅ System dependencies check passed"
echo ""

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create and activate virtual environment
echo "🐍 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate
echo "✅ Virtual environment activated"

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip install -r requirements.txt

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

# Copy environment file
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.local .env
fi

echo ""
echo "🎉 Setup complete! You can now run:"
echo ""
echo "1. Test with example URLs:"
echo "   npm run test:cli"
echo ""
echo "2. Test with custom URL:"
echo "   node generate-thumbnails-cli.js \"https://www.tiktok.com/@user/video/123\""
echo ""
echo "3. Test with URL file:"
echo "   node generate-thumbnails-cli.js --file example-urls.txt"
echo ""
echo "4. Run comprehensive test:"
echo "   npm run test:local"
echo ""
echo "5. Start YOLO service (optional, in another terminal):"
echo "   npm run yolo:start"
echo ""
echo "📁 Thumbnails will be saved to: ./generated_thumbnails/"
echo ""
echo "📖 For more information, see: LOCAL_TESTING.md"
echo ""

# Ask if user wants to run a test
read -p "🚀 Would you like to run a test now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Running test with example URLs..."
    npm run test:cli
fi
