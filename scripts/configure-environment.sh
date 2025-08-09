#!/bin/bash

# TikTok Commerce Link Hub - Environment Configuration Script
# Usage: ./scripts/configure-environment.sh <environment>
# Example: ./scripts/configure-environment.sh prod

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if environment is provided
if [ $# -eq 0 ]; then
    log_error "Environment not specified"
    echo "Usage: $0 <environment>"
    echo "Available environments: dev, staging, prod"
    exit 1
fi

ENVIRONMENT=$1
PROJECT_NAME="buylink"
NAME_PREFIX="${PROJECT_NAME}-${ENVIRONMENT}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    echo "Available environments: dev, staging, prod"
    exit 1
fi

echo "=== TikTok Commerce Link Hub Environment Configuration ==="
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Name Prefix: $NAME_PREFIX"
echo ""

# Check AWS credentials
log_info "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    log_success "AWS credentials configured for account: $AWS_ACCOUNT in region: $AWS_REGION"
else
    log_error "AWS credentials not configured or invalid"
    echo "Please run 'aws configure' or set AWS environment variables"
    exit 1
fi

echo ""
echo "=== Retrieving Infrastructure Configuration ==="
echo ""

# Navigate to Terraform directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../infra/terraform"

cd "$TERRAFORM_DIR"

# Check if Terraform state exists
if [ ! -f "terraform.tfstate" ]; then
    log_error "Terraform state not found. Please deploy infrastructure first."
    echo "Run: ./deploy-bootstrap.sh $ENVIRONMENT"
    exit 1
fi

log_info "Retrieving Terraform outputs..."

# Get Terraform outputs
OUTPUTS=$(terraform output -json 2>/dev/null)

if [ $? -ne 0 ]; then
    log_error "Failed to retrieve Terraform outputs"
    exit 1
fi

# Extract configuration values
ALB_DNS_NAME=$(echo "$OUTPUTS" | jq -r '.alb_dns_name.value // empty')
APP_CONFIG=$(echo "$OUTPUTS" | jq -r '.application_config.value // {}')

# Extract individual values from app config
DYNAMODB_USERS_TABLE=$(echo "$APP_CONFIG" | jq -r '.DYNAMODB_USERS_TABLE // empty')
DYNAMODB_SHOPS_TABLE=$(echo "$APP_CONFIG" | jq -r '.DYNAMODB_SHOPS_TABLE // empty')
DYNAMODB_PRODUCTS_TABLE=$(echo "$APP_CONFIG" | jq -r '.DYNAMODB_PRODUCTS_TABLE // empty')
DYNAMODB_ADMIN_SESSIONS_TABLE=$(echo "$APP_CONFIG" | jq -r '.DYNAMODB_ADMIN_SESSIONS_TABLE // empty')
DYNAMODB_INGESTION_STATE_TABLE=$(echo "$APP_CONFIG" | jq -r '.DYNAMODB_INGESTION_STATE_TABLE // empty')

SNS_NEW_VIDEO_POSTED_TOPIC_ARN=$(echo "$APP_CONFIG" | jq -r '.SNS_NEW_VIDEO_POSTED_TOPIC_ARN // empty')

SQS_THUMBNAIL_GENERATION_QUEUE_URL=$(echo "$APP_CONFIG" | jq -r '.SQS_THUMBNAIL_GENERATION_QUEUE_URL // empty')
SQS_CAPTION_PARSING_QUEUE_URL=$(echo "$APP_CONFIG" | jq -r '.SQS_CAPTION_PARSING_QUEUE_URL // empty')
SQS_PRODUCT_ASSEMBLY_QUEUE_URL=$(echo "$APP_CONFIG" | jq -r '.SQS_PRODUCT_ASSEMBLY_QUEUE_URL // empty')

S3_THUMBNAILS_BUCKET_NAME=$(echo "$APP_CONFIG" | jq -r '.S3_THUMBNAILS_BUCKET_NAME // empty')

COGNITO_USER_POOL_ID=$(echo "$APP_CONFIG" | jq -r '.COGNITO_USER_POOL_ID // empty')
COGNITO_CLIENT_ID=$(echo "$APP_CONFIG" | jq -r '.COGNITO_CLIENT_ID // empty')

log_success "Configuration retrieved successfully"

echo ""
echo "=== Creating Environment Files ==="
echo ""

# Function to create environment file
create_env_file() {
    local service_path=$1
    local service_name=$2
    
    log_info "Creating environment file for $service_name..."
    
    local env_file="$SCRIPT_DIR/../$service_path/.env"
    
    # Copy from example if .env doesn't exist
    if [ ! -f "$env_file" ] && [ -f "$SCRIPT_DIR/../$service_path/.env.example" ]; then
        cp "$SCRIPT_DIR/../$service_path/.env.example" "$env_file"
        log_info "Created $env_file from .env.example"
    fi
    
    # Update environment-specific values
    if [ -f "$env_file" ]; then
        # Update common values
        sed -i.bak "s|NODE_ENV=.*|NODE_ENV=${ENVIRONMENT}|g" "$env_file"
        sed -i.bak "s|AWS_REGION=.*|AWS_REGION=${AWS_REGION}|g" "$env_file"
        
        # Update service-specific values based on service name
        case "$service_name" in
            "ingestion-api")
                sed -i.bak "s|DYNAMODB_USERS_TABLE=.*|DYNAMODB_USERS_TABLE=${DYNAMODB_USERS_TABLE}|g" "$env_file"
                sed -i.bak "s|DYNAMODB_SHOPS_TABLE=.*|DYNAMODB_SHOPS_TABLE=${DYNAMODB_SHOPS_TABLE}|g" "$env_file"
                sed -i.bak "s|DYNAMODB_PRODUCTS_TABLE=.*|DYNAMODB_PRODUCTS_TABLE=${DYNAMODB_PRODUCTS_TABLE}|g" "$env_file"
                sed -i.bak "s|DYNAMODB_ADMIN_SESSIONS_TABLE=.*|DYNAMODB_ADMIN_SESSIONS_TABLE=${DYNAMODB_ADMIN_SESSIONS_TABLE}|g" "$env_file"
                sed -i.bak "s|DYNAMODB_INGESTION_STATE_TABLE=.*|DYNAMODB_INGESTION_STATE_TABLE=${DYNAMODB_INGESTION_STATE_TABLE}|g" "$env_file"
                sed -i.bak "s|SNS_NEW_VIDEO_POSTED_TOPIC_ARN=.*|SNS_NEW_VIDEO_POSTED_TOPIC_ARN=${SNS_NEW_VIDEO_POSTED_TOPIC_ARN}|g" "$env_file"
                sed -i.bak "s|COGNITO_USER_POOL_ID=.*|COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}|g" "$env_file"
                ;;
            "product-service")
                sed -i.bak "s|DYNAMODB_PRODUCTS_TABLE=.*|DYNAMODB_PRODUCTS_TABLE=${DYNAMODB_PRODUCTS_TABLE}|g" "$env_file"
                sed -i.bak "s|SQS_QUEUE_URL=.*|SQS_QUEUE_URL=${SQS_PRODUCT_ASSEMBLY_QUEUE_URL}|g" "$env_file"
                sed -i.bak "s|SNS_TOPIC_ARN=.*|SNS_TOPIC_ARN=${SNS_NEW_VIDEO_POSTED_TOPIC_ARN}|g" "$env_file"
                ;;
            "thumbnail-generator")
                sed -i.bak "s|SQS_QUEUE_URL=.*|SQS_QUEUE_URL=${SQS_THUMBNAIL_GENERATION_QUEUE_URL}|g" "$env_file"
                sed -i.bak "s|SNS_TOPIC_ARN=.*|SNS_TOPIC_ARN=${SNS_NEW_VIDEO_POSTED_TOPIC_ARN}|g" "$env_file"
                sed -i.bak "s|S3_BUCKET_NAME=.*|S3_BUCKET_NAME=${S3_THUMBNAILS_BUCKET_NAME}|g" "$env_file"
                ;;
            "caption-parser")
                sed -i.bak "s|SQS_QUEUE_URL=.*|SQS_QUEUE_URL=${SQS_CAPTION_PARSING_QUEUE_URL}|g" "$env_file"
                sed -i.bak "s|SNS_TOPIC_ARN=.*|SNS_TOPIC_ARN=${SNS_NEW_VIDEO_POSTED_TOPIC_ARN}|g" "$env_file"
                ;;
        esac
        
        # Remove backup files
        rm -f "$env_file.bak"
        
        log_success "Updated $env_file"
    else
        log_warning "No .env.example found for $service_name"
    fi
}

# Create environment files for each service
create_env_file "apps/ingestion-api" "ingestion-api"
create_env_file "apps/product-service" "product-service"
create_env_file "apps/ai-workers/thumbnail-generator" "thumbnail-generator"
create_env_file "apps/ai-workers/caption-parser" "caption-parser"

echo ""
echo "=== Environment Configuration Complete ==="
echo ""

log_success "Environment: $ENVIRONMENT"
log_success "ALB DNS Name: $ALB_DNS_NAME"

echo ""
echo "=== Configuration Summary ==="
echo ""

echo "DynamoDB Tables:"
echo "  - Users: $DYNAMODB_USERS_TABLE"
echo "  - Shops: $DYNAMODB_SHOPS_TABLE"
echo "  - Products: $DYNAMODB_PRODUCTS_TABLE"
echo "  - Admin Sessions: $DYNAMODB_ADMIN_SESSIONS_TABLE"
echo "  - Ingestion State: $DYNAMODB_INGESTION_STATE_TABLE"

echo ""
echo "SQS Queues:"
echo "  - Thumbnail Generation: $SQS_THUMBNAIL_GENERATION_QUEUE_URL"
echo "  - Caption Parsing: $SQS_CAPTION_PARSING_QUEUE_URL"
echo "  - Product Assembly: $SQS_PRODUCT_ASSEMBLY_QUEUE_URL"

echo ""
echo "S3 Buckets:"
echo "  - Thumbnails: $S3_THUMBNAILS_BUCKET_NAME"

echo ""
echo "Cognito:"
echo "  - User Pool ID: $COGNITO_USER_POOL_ID"

echo ""
echo "=== Next Steps ==="
echo ""

echo "1. Review and update .env files in each service directory"
echo "2. Set up secrets using: ./scripts/setup-secrets.sh $ENVIRONMENT"
echo "3. Build and deploy services"

echo ""
log_success "Environment configuration completed successfully!"
