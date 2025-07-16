#!/bin/bash

# Production startup script for Thumbnail Generator Worker
# Starts both YOLO service and Node.js worker

set -e

echo "🚀 Starting Thumbnail Generator Worker (Production Mode)"
echo "======================================================="

# Check if required environment variables are set
if [ -z "$AWS_REGION" ]; then
    echo "❌ AWS_REGION environment variable is required"
    exit 1
fi

if [ -z "$SQS_QUEUE_URL" ]; then
    echo "❌ SQS_QUEUE_URL environment variable is required"
    exit 1
fi

if [ -z "$SNS_TOPIC_ARN" ]; then
    echo "❌ SNS_TOPIC_ARN environment variable is required"
    exit 1
fi

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "❌ S3_BUCKET_NAME environment variable is required"
    exit 1
fi

# Set default values for optional variables
export YOLO_SERVICE_URL=${YOLO_SERVICE_URL:-"http://localhost:8000"}
export YOLO_SERVICE_PORT=${YOLO_SERVICE_PORT:-"8000"}
export YOLO_MODEL_PATH=${YOLO_MODEL_PATH:-"yolov8n.pt"}
export THUMBNAILS_TO_GENERATE=${THUMBNAILS_TO_GENERATE:-"5"}
export LOG_LEVEL=${LOG_LEVEL:-"info"}

echo "📋 Configuration:"
echo "  AWS Region: $AWS_REGION"
echo "  SQS Queue: $SQS_QUEUE_URL"
echo "  SNS Topic: $SNS_TOPIC_ARN"
echo "  S3 Bucket: $S3_BUCKET_NAME"
echo "  YOLO Service: $YOLO_SERVICE_URL"
echo "  Thumbnails per video: $THUMBNAILS_TO_GENERATE"
echo "  Log Level: $LOG_LEVEL"
echo ""

# Check if required system dependencies are installed
echo "🔍 Checking system dependencies..."

if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg is not installed. Please install ffmpeg."
    exit 1
fi

if ! command -v yt-dlp &> /dev/null; then
    echo "❌ yt-dlp is not installed. Please install yt-dlp."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ python3 is not installed. Please install Python 3."
    exit 1
fi

echo "✅ System dependencies check passed"

# Install Python dependencies if not already installed
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt --quiet

# Download YOLO model if it doesn't exist
if [ ! -f "$YOLO_MODEL_PATH" ]; then
    echo "📥 Downloading YOLO model: $YOLO_MODEL_PATH"
    python3 -c "
from ultralytics import YOLO
model = YOLO('$YOLO_MODEL_PATH')
print('YOLO model downloaded successfully')
"
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ ! -z "$YOLO_PID" ]; then
        kill $YOLO_PID 2>/dev/null || true
        echo "  YOLO service stopped"
    fi
    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null || true
        echo "  Node.js worker stopped"
    fi
    echo "✅ Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start YOLO service in background
echo "🧠 Starting YOLO service on port $YOLO_SERVICE_PORT..."
python3 python/yolo_service.py &
YOLO_PID=$!

# Wait for YOLO service to start
echo "⏳ Waiting for YOLO service to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:$YOLO_SERVICE_PORT/health" > /dev/null 2>&1; then
        echo "✅ YOLO service is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ YOLO service failed to start within 30 seconds"
        cleanup
        exit 1
    fi
    sleep 1
done

# Build Node.js application if not already built
if [ ! -d "dist" ]; then
    echo "🔨 Building Node.js application..."
    npm run build
fi

# Start Node.js worker
echo "⚙️  Starting Node.js thumbnail generator worker..."
node dist/index.js &
WORKER_PID=$!

echo ""
echo "🎉 Thumbnail Generator Worker is running!"
echo ""
echo "Services:"
echo "  🧠 YOLO Service: http://localhost:$YOLO_SERVICE_PORT"
echo "  ⚙️  Worker Process: PID $WORKER_PID"
echo ""
echo "Monitoring:"
echo "  📊 Health Check: http://localhost:8080/health"
echo "  📝 Logs: Check console output"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for worker process to finish
wait $WORKER_PID

# If worker exits, cleanup
cleanup
