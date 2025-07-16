# TikTok Commerce AI Workers Deployment Guide

This guide covers deploying the three AI workers (Caption Parser, Thumbnail Generator, Auto Tagger) to production while keeping the Ingestion API running locally for development.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Local Dev     │    │   Production    │    │   Production    │
│                 │    │                 │    │                 │
│ Ingestion API   │───▶│ SNS Topics      │───▶│ AI Workers      │
│ (Port 3001)     │    │ SQS Queues      │    │                 │
│                 │    │ S3 Buckets      │    │ • Caption Parser│
│ PostgreSQL      │    │                 │    │ • Thumbnail Gen │
│ (Port 5432)     │    │                 │    │ • Auto Tagger   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

### Required Tools
- AWS CLI v2 configured with appropriate permissions
- Docker Desktop running
- Node.js 18+ and npm
- Terraform 1.5+
- curl and jq for monitoring

### Required Environment Variables
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
export OPENROUTER_API_KEY="your-openrouter-api-key"
export LLM_MODEL="anthropic/claude-3.5-sonnet"
```

### AWS Permissions Required
- Lambda: Full access for Caption Parser and Auto Tagger
- ECS: Full access for Thumbnail Generator
- SNS: Create and publish to topics
- SQS: Create and manage queues
- S3: Create buckets and upload objects
- CloudWatch: Create log groups and read metrics
- ECR: Push Docker images

## 🚀 Deployment Process

### Step 1: Deploy AI Workers to Production

```bash
# Make the deployment script executable
chmod +x deploy-ai-workers.sh

# Run the deployment
./deploy-ai-workers.sh
```

This script will:
1. ✅ Validate environment variables
2. 🏗️ Deploy infrastructure with Terraform
3. 📝 Deploy Caption Parser (Lambda)
4. 🖼️ Deploy Thumbnail Generator (ECS)
5. 🏷️ Deploy Auto Tagger (Lambda)
6. 📄 Create local environment file

### Step 2: Start Local Development

```bash
# Make the local development script executable
chmod +x start-local-dev.sh

# Start local development environment
./start-local-dev.sh
```

This script will:
1. 🗄️ Start local PostgreSQL database
2. 🔗 Test connection to production AI workers
3. 📦 Setup Ingestion API
4. 🚀 Start Ingestion API on port 3001

## 📊 Monitoring

### Real-time Monitoring

```bash
# Make the monitoring script executable
chmod +x monitor-ai-workers.sh

# Start continuous monitoring
./monitor-ai-workers.sh

# Or check specific components
./monitor-ai-workers.sh --queues    # SQS queue status
./monitor-ai-workers.sh --services  # Service health
./monitor-ai-workers.sh --errors    # Recent errors
./monitor-ai-workers.sh --metrics   # Performance metrics
```

### Manual Monitoring

#### SQS Queues
```bash
aws sqs get-queue-attributes \
  --queue-url "YOUR_QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessages
```

#### Lambda Functions
```bash
aws lambda get-function \
  --function-name "tiktok-commerce-prod-caption-parser"
```

#### ECS Service
```bash
aws ecs describe-services \
  --cluster "tiktok-commerce-prod" \
  --services "thumbnail-generator"
```

## 🧪 Testing the Integration

### 1. Test Video Processing

```bash
curl -X POST http://localhost:3001/api/videos \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://www.tiktok.com/@user/video/123",
    "seller_handle": "test-seller"
  }'
```

### 2. Monitor Processing Flow

1. **Video Posted Event** → SNS Topic
2. **Caption Parser** → Processes caption → SNS Event
3. **Thumbnail Generator** → Creates 5 thumbnails → SNS Event
4. **Auto Tagger** → Generates tags → SNS Event
5. **Results** → Stored in local database

### 3. Check Results

```bash
# Check shop products
curl http://localhost:3001/api/shops/test-seller

# Check all products
curl http://localhost:3001/api/products
```

## 🔧 Configuration

### AI Worker Settings

#### Caption Parser
- **LLM Provider**: OpenRouter
- **Model**: Claude 3.5 Sonnet
- **Batch Size**: 10 messages
- **Timeout**: 15 minutes

#### Thumbnail Generator
- **Thumbnails per Video**: 5
- **YOLO Model**: YOLOv8n
- **Max Video Size**: 50MB
- **Thumbnail Size**: 400x400px

#### Auto Tagger
- **LLM Provider**: OpenRouter
- **Model**: Claude 3.5 Sonnet
- **Max Tags**: 10 per product
- **Confidence Threshold**: 0.6

### Local Development Settings

```bash
# apps/ingestion-api/.env.local
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://localhost:5432/tiktok_commerce_dev

# Production AI Workers (auto-configured)
SNS_VIDEO_POSTED_TOPIC=arn:aws:sns:...
SQS_CAPTION_PARSER_QUEUE=https://sqs...
# ... other production endpoints
```

## 🚨 Troubleshooting

### Common Issues

#### 1. AWS Permissions Error
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify permissions
aws iam get-user
```

#### 2. OpenRouter API Key Issues
```bash
# Test OpenRouter connection
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models
```

#### 3. Docker Issues
```bash
# Check Docker status
docker info

# Restart Docker if needed
sudo systemctl restart docker
```

#### 4. Database Connection Issues
```bash
# Check PostgreSQL container
docker ps | grep tiktok-commerce-db

# Check database connectivity
docker exec tiktok-commerce-db pg_isready -U postgres
```

### Logs and Debugging

#### Local Logs
- Ingestion API: Console output
- Database: `docker logs tiktok-commerce-db`

#### Production Logs
- Caption Parser: CloudWatch `/aws/lambda/tiktok-commerce-prod-caption-parser`
- Thumbnail Generator: CloudWatch `/aws/ecs/tiktok-commerce-prod/thumbnail-generator`
- Auto Tagger: CloudWatch `/aws/lambda/tiktok-commerce-prod-auto-tagger`

## 🔄 Updates and Redeployment

### Update AI Workers
```bash
# Redeploy all workers
./deploy-ai-workers.sh

# Or deploy individual workers
cd apps/ai-workers/caption-parser && npm run build && aws lambda update-function-code...
```

### Update Local Environment
```bash
# Stop local services
Ctrl+C

# Restart with latest configuration
./start-local-dev.sh
```

## 📈 Performance Optimization

### Scaling Configuration

#### Lambda Functions
- **Memory**: 512MB (Caption Parser), 1024MB (Auto Tagger)
- **Timeout**: 15 minutes
- **Concurrent Executions**: 100

#### ECS Service
- **CPU**: 1 vCPU
- **Memory**: 2GB
- **Auto Scaling**: 1-5 tasks based on CPU/memory

#### SQS Queues
- **Visibility Timeout**: 15 minutes
- **Message Retention**: 14 days
- **Dead Letter Queue**: After 3 retries

## 🛡️ Security Considerations

- All AI workers run in private subnets
- IAM roles follow least privilege principle
- API keys stored in AWS Secrets Manager
- VPC endpoints for AWS service communication
- CloudWatch monitoring and alerting enabled

## 💰 Cost Optimization

### Estimated Monthly Costs (1000 videos/day)
- **Lambda Functions**: ~$50/month
- **ECS Service**: ~$30/month
- **SQS/SNS**: ~$5/month
- **S3 Storage**: ~$10/month
- **CloudWatch**: ~$10/month
- **Total**: ~$105/month

### Cost Reduction Tips
- Use Spot instances for ECS tasks
- Implement S3 lifecycle policies
- Optimize Lambda memory allocation
- Use CloudWatch log retention policies
