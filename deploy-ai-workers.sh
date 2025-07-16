#!/bin/bash

# Production Deployment Script for TikTok Commerce AI Workers
# Deploys: Caption Parser, Thumbnail Generator, Auto Tagger
# Sets up: SNS Topics, SQS Queues, S3 Buckets, Lambda Functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"prod"}
AWS_REGION=${AWS_REGION:-"us-east-1"}
PROJECT_NAME="tiktok-commerce"

# OpenRouter Configuration
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-""}
LLM_MODEL=${LLM_MODEL:-"microsoft/phi-3-mini-128k-instruct:free"}

echo -e "${BLUE}🚀 TikTok Commerce AI Workers Deployment${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Environment: $ENVIRONMENT"
echo "  AWS Region: $AWS_REGION"
echo "  Project: $PROJECT_NAME"
echo "  LLM Provider: OpenRouter"
echo "  LLM Model: $LLM_MODEL"
echo ""

# Validate required environment variables
validate_env() {
    echo -e "${YELLOW}🔍 Validating environment variables...${NC}"
    
    if [ -z "$AWS_ACCESS_KEY_ID" ]; then
        echo -e "${RED}❌ AWS_ACCESS_KEY_ID is required${NC}"
        exit 1
    fi
    
    if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo -e "${RED}❌ AWS_SECRET_ACCESS_KEY is required${NC}"
        exit 1
    fi
    
    if [ -z "$OPENROUTER_API_KEY" ]; then
        echo -e "${RED}❌ OPENROUTER_API_KEY is required for LLM services${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment validation passed${NC}"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    echo -e "${YELLOW}🏗️  Deploying infrastructure with Terraform...${NC}"
    
    cd infra/terraform
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="aws_region=$AWS_REGION" \
        -var="openrouter_api_key=$OPENROUTER_API_KEY" \
        -var="llm_model=$LLM_MODEL" \
        -out=tfplan
    
    # Apply deployment
    terraform apply tfplan
    
    # Get outputs for later use
    export SQS_CAPTION_PARSER_QUEUE=$(terraform output -raw caption_parser_queue_url)
    export SQS_THUMBNAIL_GENERATOR_QUEUE=$(terraform output -raw thumbnail_generator_queue_url)
    export SQS_AUTO_TAGGER_QUEUE=$(terraform output -raw auto_tagger_queue_url)
    export SNS_VIDEO_POSTED_TOPIC=$(terraform output -raw video_posted_topic_arn)
    export SNS_CAPTION_PARSED_TOPIC=$(terraform output -raw caption_parsed_topic_arn)
    export SNS_THUMBNAIL_GENERATED_TOPIC=$(terraform output -raw thumbnail_generated_topic_arn)
    export SNS_AUTO_TAGGED_TOPIC=$(terraform output -raw auto_tagged_topic_arn)
    export S3_THUMBNAILS_BUCKET=$(terraform output -raw thumbnails_bucket_name)
    
    cd ../..
    
    echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"
}

# Build and deploy Caption Parser
deploy_caption_parser() {
    echo -e "${YELLOW}📝 Deploying Caption Parser...${NC}"
    
    cd apps/ai-workers/caption-parser
    
    # Install dependencies
    npm install
    
    # Build application
    npm run build
    
    # Create deployment package
    zip -r caption-parser-$ENVIRONMENT.zip \
        dist/ \
        node_modules/ \
        package.json \
        .env.production
    
    # Deploy to Lambda
    aws lambda update-function-code \
        --function-name "$PROJECT_NAME-$ENVIRONMENT-caption-parser" \
        --zip-file fileb://caption-parser-$ENVIRONMENT.zip \
        --region $AWS_REGION
    
    # Update environment variables
    aws lambda update-function-configuration \
        --function-name "$PROJECT_NAME-$ENVIRONMENT-caption-parser" \
        --environment Variables="{
            NODE_ENV=production,
            AWS_REGION=$AWS_REGION,
            SQS_QUEUE_URL=$SQS_CAPTION_PARSER_QUEUE,
            SNS_TOPIC_ARN=$SNS_CAPTION_PARSED_TOPIC,
            LLM_PROVIDER=openrouter,
            LLM_MODEL=$LLM_MODEL,
            OPENROUTER_API_KEY=$OPENROUTER_API_KEY,
            LOG_LEVEL=info
        }" \
        --region $AWS_REGION
    
    cd ../../..
    
    echo -e "${GREEN}✅ Caption Parser deployed${NC}"
}

# Build and deploy Thumbnail Generator
deploy_thumbnail_generator() {
    echo -e "${YELLOW}🖼️  Deploying Thumbnail Generator...${NC}"
    
    cd apps/ai-workers/thumbnail-generator
    
    # Build Docker image
    docker build -f Dockerfile.worker -t $PROJECT_NAME-thumbnail-generator:$ENVIRONMENT .
    
    # Tag for ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
    
    docker tag $PROJECT_NAME-thumbnail-generator:$ENVIRONMENT $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-thumbnail-generator:$ENVIRONMENT
    
    # Push to ECR
    docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-thumbnail-generator:$ENVIRONMENT
    
    # Update ECS service
    aws ecs update-service \
        --cluster "$PROJECT_NAME-$ENVIRONMENT" \
        --service "thumbnail-generator" \
        --force-new-deployment \
        --region $AWS_REGION
    
    cd ../../..
    
    echo -e "${GREEN}✅ Thumbnail Generator deployed${NC}"
}

# Build and deploy Auto Tagger
deploy_auto_tagger() {
    echo -e "${YELLOW}🏷️  Deploying Auto Tagger...${NC}"
    
    cd apps/ai-workers/auto-tagger
    
    # Install dependencies
    npm install
    
    # Build application
    npm run build
    
    # Create deployment package
    zip -r auto-tagger-$ENVIRONMENT.zip \
        dist/ \
        node_modules/ \
        package.json \
        .env.production
    
    # Deploy to Lambda
    aws lambda update-function-code \
        --function-name "$PROJECT_NAME-$ENVIRONMENT-auto-tagger" \
        --zip-file fileb://auto-tagger-$ENVIRONMENT.zip \
        --region $AWS_REGION
    
    # Update environment variables
    aws lambda update-function-configuration \
        --function-name "$PROJECT_NAME-$ENVIRONMENT-auto-tagger" \
        --environment Variables="{
            NODE_ENV=production,
            AWS_REGION=$AWS_REGION,
            SQS_QUEUE_URL=$SQS_AUTO_TAGGER_QUEUE,
            SNS_TOPIC_ARN=$SNS_AUTO_TAGGED_TOPIC,
            LLM_PROVIDER=openrouter,
            LLM_MODEL=$LLM_MODEL,
            OPENROUTER_API_KEY=$OPENROUTER_API_KEY,
            LOG_LEVEL=info
        }" \
        --region $AWS_REGION
    
    cd ../../..
    
    echo -e "${GREEN}✅ Auto Tagger deployed${NC}"
}

# Create local environment file for ingestion API
create_local_env() {
    echo -e "${YELLOW}📄 Creating local environment configuration...${NC}"
    
    cat > apps/ingestion-api/.env.local << EOF
# Local Development Configuration
# Connects to Production AI Workers

NODE_ENV=development
PORT=3001

# AWS Configuration (Production)
AWS_REGION=$AWS_REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

# Production SNS Topics (for publishing events)
SNS_VIDEO_POSTED_TOPIC=$SNS_VIDEO_POSTED_TOPIC

# Production SQS Queues (for monitoring)
SQS_CAPTION_PARSER_QUEUE=$SQS_CAPTION_PARSER_QUEUE
SQS_THUMBNAIL_GENERATOR_QUEUE=$SQS_THUMBNAIL_GENERATOR_QUEUE
SQS_AUTO_TAGGER_QUEUE=$SQS_AUTO_TAGGER_QUEUE

# Production SNS Topics (for subscribing to results)
SNS_CAPTION_PARSED_TOPIC=$SNS_CAPTION_PARSED_TOPIC
SNS_THUMBNAIL_GENERATED_TOPIC=$SNS_THUMBNAIL_GENERATED_TOPIC
SNS_AUTO_TAGGED_TOPIC=$SNS_AUTO_TAGGED_TOPIC

# Local Database
DATABASE_URL=postgresql://localhost:5432/tiktok_commerce_dev

# Authentication
JWT_SECRET=your-local-jwt-secret
COGNITO_USER_POOL_ID=your-cognito-user-pool-id
COGNITO_CLIENT_ID=your-cognito-client-id

# TikTok API
APIFY_API_TOKEN=your-apify-token

# Logging
LOG_LEVEL=debug
EOF

    echo -e "${GREEN}✅ Local environment file created: apps/ingestion-api/.env.local${NC}"
}

# Display deployment summary
show_summary() {
    echo ""
    echo -e "${BLUE}🎉 Deployment Summary${NC}"
    echo -e "${BLUE}===================${NC}"
    echo ""
    echo -e "${GREEN}✅ Infrastructure:${NC}"
    echo "  📊 SNS Topics: 4 topics created"
    echo "  📬 SQS Queues: 3 queues created"
    echo "  🪣 S3 Buckets: Thumbnails bucket ready"
    echo ""
    echo -e "${GREEN}✅ AI Workers:${NC}"
    echo "  📝 Caption Parser: Lambda function deployed"
    echo "  🖼️  Thumbnail Generator: ECS service deployed"
    echo "  🏷️  Auto Tagger: Lambda function deployed"
    echo ""
    echo -e "${GREEN}✅ Local Development:${NC}"
    echo "  📄 Environment file: apps/ingestion-api/.env.local"
    echo "  🔗 Connected to production AI workers"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Start your local ingestion API:"
    echo "   cd apps/ingestion-api && npm run dev"
    echo ""
    echo "2. Test the integration:"
    echo "   POST /api/videos with TikTok video URL"
    echo ""
    echo "3. Monitor AI workers:"
    echo "   - CloudWatch Logs for Lambda functions"
    echo "   - ECS Console for Thumbnail Generator"
    echo "   - SQS Console for queue metrics"
    echo ""
    echo -e "${YELLOW}🔗 Production Endpoints:${NC}"
    echo "  SNS Video Posted: $SNS_VIDEO_POSTED_TOPIC"
    echo "  Caption Parser Queue: $SQS_CAPTION_PARSER_QUEUE"
    echo "  Thumbnail Generator Queue: $SQS_THUMBNAIL_GENERATOR_QUEUE"
    echo "  Auto Tagger Queue: $SQS_AUTO_TAGGER_QUEUE"
    echo ""
}

# Main deployment flow
main() {
    validate_env
    deploy_infrastructure
    deploy_caption_parser
    deploy_thumbnail_generator
    deploy_auto_tagger
    create_local_env
    show_summary
}

# Run deployment
main "$@"
