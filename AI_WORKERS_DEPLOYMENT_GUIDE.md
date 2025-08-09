# AI Workers Deployment Guide

## Overview

This guide covers the deployment of two lightweight, event-driven AI workers for the TikTok commerce ingestion pipeline:

1. **Caption Parser** - Extracts product information from TikTok captions using LLM
2. **Thumbnail Generator** - Creates product thumbnails from video frames using YOLO + FFmpeg

## Architecture

```
Scheduled Ingestion → SNS (new-video-posted) → SQS Queues → AI Workers → SNS (processed events)
                                              ↓
                                    ┌─ caption-parser-queue
                                    └─ thumbnail-generator-queue
```

## Worker Details

### 1. Caption Parser Worker
- **Runtime**: Node.js 18.x (Lambda)
- **Memory**: 512MB
- **Timeout**: 5 minutes
- **Function**: Extracts title, price, sizes, and tags from captions
- **LLM Options**: OpenRouter (Phi-3), Ollama, OpenAI
- **Output**: `caption-parsed` event

### 2. Thumbnail Generator Worker  
- **Runtime**: Node.js 18.x (Lambda/Fargate)
- **Memory**: 1024MB
- **Timeout**: 15 minutes
- **Function**: Downloads videos, extracts frames, runs YOLO detection, uploads to S3
- **Dependencies**: FFmpeg, yt-dlp, YOLOv8n, Sharp
- **Output**: `thumbnail-generated` event

### 3. Auto-Tagger Worker
- **Runtime**: Node.js 18.x (Lambda)
- **Memory**: 512MB  
- **Timeout**: 5 minutes
- **Function**: Generates semantic and category tags using LLM
- **Output**: `tags-generated` event

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.0
3. **Node.js** >= 18
4. **Python** >= 3.11 (for YOLO)
5. **LLM API Key** (OpenRouter recommended for free tier)

## Environment Variables

### Required for All Workers
```bash
AWS_REGION=us-east-1
NODE_ENV=production
LOG_LEVEL=info
```

### LLM Configuration
```bash
# Option 1: OpenRouter (Recommended - Free Tier)
LLM_PROVIDER=openrouter
LLM_MODEL=microsoft/phi-3-mini-4k-instruct
OPENROUTER_API_KEY=your-key-here

# Option 2: Local Ollama
LLM_PROVIDER=ollama
LLM_MODEL=phi3:mini
OLLAMA_BASE_URL=http://localhost:11434

# Option 3: OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-3.5-turbo
OPENAI_API_KEY=your-key-here
```

### Worker-Specific Variables
```bash
# Caption Parser
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../caption-parser-queue
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:.../caption-parsed

# Thumbnail Generator
S3_BUCKET_NAME=your-bucket-product-thumbnails
MAX_VIDEO_SIZE_MB=50
MAX_VIDEO_DURATION_SECONDS=60
YOLO_MODEL_PATH=yolov8n.pt

# Auto-Tagger
# (Uses same LLM config as Caption Parser)
```

## Deployment Steps

### 1. Build Workers
```bash
# Caption Parser
cd apps/ai-workers/caption-parser
npm install
npm run build
zip -r caption-parser.zip dist/ node_modules/ package.json

# Thumbnail Generator  
cd ../thumbnail-generator
npm install
pip install -r requirements.txt
npm run build
zip -r thumbnail-generator.zip dist/ node_modules/ package.json python/


```

### 2. Deploy Infrastructure
```bash
cd infra/terraform

# Set required variables
export TF_VAR_openrouter_api_key="your-key-here"
export TF_VAR_llm_provider="openrouter"
export TF_VAR_llm_model="microsoft/phi-3-mini-4k-instruct"

# Deploy
terraform init
terraform plan
terraform apply
```

### 3. Upload Lambda Packages
```bash
# Upload the zip files to Lambda functions
aws lambda update-function-code \
  --function-name tiktok-commerce-dev-caption-parser \
  --zip-file fileb://caption-parser.zip

aws lambda update-function-code \
  --function-name tiktok-commerce-dev-thumbnail-generator \
  --zip-file fileb://thumbnail-generator.zip


```

## Testing

### 1. Test Caption Parser
```bash
cd apps/ai-workers/caption-parser
npm run test
# Or test with real message:
node test-worker.js
```

### 2. Test Thumbnail Generator
```bash
cd apps/ai-workers/thumbnail-generator
npm run test
# Requires video URL for testing
```



### 4. End-to-End Test
```bash
# Send test message to ingestion queue
aws sqs send-message \
  --queue-url "https://sqs.us-east-1.amazonaws.com/.../new-video-posted" \
  --message-body '{
    "video_id": "test123",
    "caption": "🔥 New heels only 55k! Sizes 37–41 #TRACK",
    "seller_handle": "test-seller",
    "video_url": "https://www.tiktok.com/@test/video/123"
  }'
```

## Monitoring

### CloudWatch Metrics
- **Caption Parser**: Processing time, success rate, LLM API calls
- **Thumbnail Generator**: Video processing time, S3 uploads, YOLO detections
- **Auto-Tagger**: Tag generation rate, confidence scores

### CloudWatch Logs
```bash
# View logs
aws logs tail /aws/lambda/tiktok-commerce-dev-caption-parser --follow
aws logs tail /aws/lambda/tiktok-commerce-dev-thumbnail-generator --follow
aws logs tail /aws/lambda/tiktok-commerce-dev-auto-tagger --follow
```

### Key Metrics to Monitor
- **Error Rate**: < 5%
- **Processing Time**: 
  - Caption Parser: < 30s
  - Thumbnail Generator: < 5 minutes
  - Auto-Tagger: < 15s
- **Cost**: Stay within free tier limits

## Cost Optimization

### Free Tier Limits
- **Lambda**: 1M requests/month, 400,000 GB-seconds
- **S3**: 5GB storage, 20,000 GET requests
- **SQS**: 1M requests/month
- **SNS**: 1M publishes/month

### Optimization Strategies
1. **Use OpenRouter** for free LLM access
2. **Batch processing** in workers
3. **Compress thumbnails** to reduce S3 costs
4. **Set S3 lifecycle policies** for old thumbnails
5. **Monitor CloudWatch costs**

## Troubleshooting

### Common Issues

1. **LLM API Failures**
   - Check API key validity
   - Monitor rate limits
   - Implement fallback parsing

2. **Video Download Failures**
   - Check TikTok URL format
   - Verify yt-dlp version
   - Handle private/deleted videos

3. **YOLO Model Issues**
   - Ensure model file exists
   - Check Python dependencies
   - Monitor memory usage

4. **S3 Upload Failures**
   - Verify bucket permissions
   - Check file size limits
   - Monitor storage quotas

### Debug Commands
```bash
# Check Lambda function status
aws lambda get-function --function-name tiktok-commerce-dev-caption-parser

# Check SQS queue attributes
aws sqs get-queue-attributes --queue-url "your-queue-url" --attribute-names All

# Check S3 bucket contents
aws s3 ls s3://your-bucket-product-thumbnails/thumbnails/ --recursive
```

## Next Steps

After successful deployment:

1. **Monitor performance** for 24-48 hours
2. **Adjust memory/timeout** based on actual usage
3. **Implement auto-scaling** if needed
4. **Set up alerts** for error rates
5. **Optimize costs** based on usage patterns

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Review this deployment guide
3. Test individual components
4. Monitor AWS service health
5. Check free tier usage limits
