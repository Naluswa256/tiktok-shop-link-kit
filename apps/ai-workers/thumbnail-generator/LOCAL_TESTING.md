# 🖼️ Local Thumbnail Generator Testing

This guide explains how to test the thumbnail generation pipeline locally without AWS dependencies.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Install system dependencies (if not already installed)
# On macOS:
brew install ffmpeg yt-dlp

# On Ubuntu/Debian:
sudo apt-get install ffmpeg yt-dlp

# On Windows:
# Download ffmpeg from https://ffmpeg.org/download.html
# Download yt-dlp from https://github.com/yt-dlp/yt-dlp
```

### 2. Build the Project

```bash
npm run build
```

### 3. Start YOLO Service (Optional)

The thumbnail generator can work with or without the YOLO service:

```bash
# Start YOLO service for AI-powered frame analysis
python3 python/yolo_service.py
```

If YOLO service is not running, the system will use fallback frame analysis.

### 4. Generate Thumbnails

#### Option A: CLI with URLs

```bash
# Single URL
node generate-thumbnails-cli.js "https://www.tiktok.com/@user/video/123456789"

# Multiple URLs
node generate-thumbnails-cli.js "url1" "url2" "url3"
```

#### Option B: CLI with File

```bash
# Create a file with URLs (one per line)
echo "https://www.tiktok.com/@nalu-fashion/video/123" > my-urls.txt
echo "https://www.tiktok.com/@seller/video/456" >> my-urls.txt

# Process URLs from file
node generate-thumbnails-cli.js --file my-urls.txt
```

#### Option C: Use Example URLs

```bash
# Use the provided example URLs
node generate-thumbnails-cli.js --file example-urls.txt
```

#### Option D: Enhanced Test Script

```bash
# Run the comprehensive test script
node test-local-thumbnails.js
```

## 📁 Output

Thumbnails are saved to `./generated_thumbnails/` directory:

```
generated_thumbnails/
├── seller-1-video_123_primary.jpg    # Primary thumbnail (best quality)
├── seller-1-video_123_0.jpg          # Thumbnail 0
├── seller-1-video_123_1.jpg          # Thumbnail 1
├── seller-1-video_123_2.jpg          # Thumbnail 2
└── seller-1-video_123_3.jpg          # Thumbnail 3
```

## 🔧 Configuration

You can modify the configuration in the test scripts:

```javascript
const config = {
  // Video processing
  maxVideoSizeMB: 50,                    // Max video file size
  maxVideoDurationSeconds: 60,           // Max video duration
  frameExtractionInterval: 2,            // Extract frame every N seconds
  maxFramesToAnalyze: 15,                // Max frames to analyze
  thumbnailsToGenerate: 5,               // Number of thumbnails per video
  
  // YOLO settings
  yoloConfidenceThreshold: 0.5,          // Object detection confidence
  yoloIouThreshold: 0.5,                 // Intersection over Union threshold
  
  // Quality thresholds
  minQualityScore: 0.4,                  // Minimum quality score
  minBrightnessScore: 0.3,               // Minimum brightness score
  maxBlurScore: 0.7,                     // Maximum blur score (lower is better)
  
  // Output settings
  thumbnailWidth: 400,                   // Thumbnail width in pixels
  thumbnailHeight: 400,                  // Thumbnail height in pixels
  thumbnailQuality: 85                   // JPEG quality (1-100)
};
```

## 🧠 YOLO Service

The YOLO service provides AI-powered frame analysis:

### Starting YOLO Service

```bash
# Start on default port 8000
python3 python/yolo_service.py

# Or specify custom port
YOLO_SERVICE_PORT=8001 python3 python/yolo_service.py
```

### YOLO Features

- **Product Detection**: Identifies products in frames
- **Quality Assessment**: Analyzes blur, brightness, composition
- **Confidence Scoring**: Provides quality scores for frame selection

### Fallback Mode

If YOLO service is not available, the system uses basic fallback analysis:
- Random quality scores
- Mock object detection
- Still generates thumbnails successfully

## 📊 Processing Pipeline

1. **Video Download**: Uses `yt-dlp` to download TikTok videos
2. **Frame Extraction**: Uses `ffmpeg` to extract frames at intervals
3. **Frame Analysis**: Uses YOLO or fallback to analyze frame quality
4. **Frame Selection**: Selects best frames based on quality scores
5. **Thumbnail Generation**: Uses Sharp to resize and optimize images
6. **Local Storage**: Saves thumbnails to local directory

## 🐛 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clean and rebuild
npm run clean
npm run build
```

#### Missing Dependencies
```bash
# Check if ffmpeg is installed
ffmpeg -version

# Check if yt-dlp is installed
yt-dlp --version

# Check Python dependencies
pip list | grep ultralytics
```

#### YOLO Service Issues
```bash
# Check if YOLO service is running
curl http://localhost:8000/health

# Check YOLO logs
python3 python/yolo_service.py
```

#### Video Download Issues
- Ensure TikTok URLs are valid and accessible
- Some videos may be region-restricted
- Check internet connection

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug node generate-thumbnails-cli.js "your-url"
```

## 🔄 Development Workflow

1. **Modify Code**: Edit TypeScript files in `src/`
2. **Rebuild**: Run `npm run build`
3. **Test**: Run CLI or test scripts
4. **Iterate**: Repeat as needed

## 📝 Example Output

```
🖼️  Thumbnail Generator CLI
============================

📊 Configuration:
   Thumbnails per video: 5
   Output directory: /path/to/generated_thumbnails
   Videos to process: 1

📹 Processing 1/1: https://www.tiktok.com/@user/video/123
────────────────────────────────────────────────────────────
✅ Processing successful!
   📊 Generated: 5 thumbnails
   🎯 Analyzed: 15 frames
   ⏱️  Duration: 30s
   🕒 Time: 12543ms
💾 Saved: seller-1-video_123_primary.jpg (45KB)
💾 Saved: seller-1-video_123_0.jpg (42KB)
💾 Saved: seller-1-video_123_1.jpg (38KB)
💾 Saved: seller-1-video_123_2.jpg (41KB)
💾 Saved: seller-1-video_123_3.jpg (39KB)
   📸 Thumbnail 1: Frame 5 (10s) - Quality: 0.85
   📸 Thumbnail 2: Frame 8 (16s) - Quality: 0.82
   📸 Thumbnail 3: Frame 2 (4s) - Quality: 0.78
   📸 Thumbnail 4: Frame 11 (22s) - Quality: 0.75
   📸 Thumbnail 5: Frame 14 (28s) - Quality: 0.72

🎉 Processing Complete!
========================
✅ Processed: 1 videos
❌ Failed: 0 videos
📁 Output: /path/to/generated_thumbnails

📸 Generated Files:
   seller-1-video_123_primary.jpg (45KB)
   seller-1-video_123_0.jpg (42KB)
   seller-1-video_123_1.jpg (38KB)
   seller-1-video_123_2.jpg (41KB)
   seller-1-video_123_3.jpg (39KB)
```

## 🎯 Next Steps

After local testing is successful:

1. **Deploy to Production**: Use the existing AWS infrastructure
2. **Update Frontend**: Integrate with the thumbnail gallery display
3. **Monitor Performance**: Track processing times and success rates
4. **Optimize Settings**: Tune quality thresholds based on results
