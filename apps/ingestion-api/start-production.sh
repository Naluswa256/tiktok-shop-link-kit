#!/bin/bash

# TikTok Commerce Authentication - Production Startup Script
# This script helps you configure and start the ingestion-api for production testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 TikTok Commerce Authentication - Production Setup${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found!"
    echo "Please ensure the .env.production file exists in the apps/ingestion-api directory."
    exit 1
fi

print_status ".env.production file found"

# Check for required secrets
echo -e "${BLUE}🔐 Checking Required Secrets...${NC}"

# Check JWT_SECRET
JWT_SECRET=$(grep "^JWT_SECRET=" .env.production | cut -d'=' -f2)
if [ "$JWT_SECRET" = "your-super-secure-jwt-secret-key-at-least-32-characters-long-please-change-this" ]; then
    print_warning "JWT_SECRET needs to be updated!"
    echo "Generating a secure JWT secret..."
    
    # Generate a secure JWT secret
    NEW_JWT_SECRET=$(openssl rand -base64 32)
    
    # Update the .env.production file
    if command -v sed &> /dev/null; then
        sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$NEW_JWT_SECRET|" .env.production
        print_status "JWT_SECRET updated with secure random value"
    else
        print_warning "Please manually update JWT_SECRET in .env.production with: $NEW_JWT_SECRET"
    fi
else
    print_status "JWT_SECRET is configured"
fi

# Check APIFY_TOKEN
APIFY_TOKEN=$(grep "^APIFY_TOKEN=" .env.production | cut -d'=' -f2)
if [ "$APIFY_TOKEN" = "your-apify-token-here" ]; then
    print_warning "APIFY_TOKEN needs to be configured!"
    echo "Please update APIFY_TOKEN in .env.production with your Apify API token."
    echo "You can get one from: https://console.apify.com/account/integrations"
    echo ""
    read -p "Enter your Apify token (or press Enter to continue without it): " USER_APIFY_TOKEN
    
    if [ ! -z "$USER_APIFY_TOKEN" ]; then
        if command -v sed &> /dev/null; then
            sed -i.bak "s|APIFY_TOKEN=.*|APIFY_TOKEN=$USER_APIFY_TOKEN|" .env.production
            print_status "APIFY_TOKEN updated"
        else
            print_warning "Please manually update APIFY_TOKEN in .env.production"
        fi
    else
        print_warning "Continuing without Apify token (handle validation will be limited)"
    fi
else
    print_status "APIFY_TOKEN is configured"
fi

echo ""

# Check AWS credentials
echo -e "${BLUE}🔑 Checking AWS Credentials...${NC}"

if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity --query Arn --output text | cut -d'/' -f2)
    print_status "AWS credentials configured"
    print_status "Account: $AWS_ACCOUNT"
    print_status "User/Role: $AWS_USER"
else
    print_error "AWS credentials not configured!"
    echo "Please run 'aws configure' or set up IAM roles."
    exit 1
fi

echo ""

# Test AWS resources
echo -e "${BLUE}🧪 Testing AWS Resources...${NC}"

# Test DynamoDB table
DYNAMODB_TABLE=$(grep "^DYNAMODB_USERS_TABLE=" .env.production | cut -d'=' -f2)
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" &> /dev/null; then
    print_status "DynamoDB table '$DYNAMODB_TABLE' is accessible"
else
    print_error "DynamoDB table '$DYNAMODB_TABLE' is not accessible"
    echo "Please check your AWS permissions and table name."
fi

# Test Cognito User Pool
COGNITO_USER_POOL_ID=$(grep "^COGNITO_USER_POOL_ID=" .env.production | cut -d'=' -f2)
if aws cognito-idp describe-user-pool --user-pool-id "$COGNITO_USER_POOL_ID" &> /dev/null; then
    print_status "Cognito User Pool '$COGNITO_USER_POOL_ID' is accessible"
else
    print_error "Cognito User Pool '$COGNITO_USER_POOL_ID' is not accessible"
    echo "Please check your AWS permissions and User Pool ID."
fi

echo ""

# Check Node.js dependencies
echo -e "${BLUE}📦 Checking Dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found. Installing dependencies..."
    npm install
    print_status "Dependencies installed"
else
    print_status "Node modules found"
fi

echo ""

# Start the application
echo -e "${BLUE}🚀 Starting Application...${NC}"

echo "Starting TikTok Commerce Authentication API in production mode..."
echo "Environment: production"
echo "Port: 3001"
echo "Cognito User Pool: $COGNITO_USER_POOL_ID"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo ""

print_status "Application configuration complete!"
echo ""
echo -e "${GREEN}🎯 Test Endpoints:${NC}"
echo "Health Check:     curl http://localhost:3001/health"
echo "Handle Validation: curl -X POST http://localhost:3001/auth/validate-handle -H 'Content-Type: application/json' -d '{\"handle\":\"testuser123\"}'"
echo "Signup:           curl -X POST http://localhost:3001/auth/signup -H 'Content-Type: application/json' -d '{\"handle\":\"testuser123\",\"phoneNumber\":\"+1234567890\"}'"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Export environment variables from .env.production
echo "Loading environment variables from .env.production..."
set -a  # automatically export all variables
source .env.production
set +a  # stop automatically exporting

# Verify critical environment variables are loaded
echo "Verifying environment variables..."
if [ -z "$COGNITO_USER_POOL_ID" ]; then
    print_error "COGNITO_USER_POOL_ID not loaded from .env.production"
    exit 1
fi

if [ -z "$COGNITO_CLIENT_ID" ]; then
    print_error "COGNITO_CLIENT_ID not loaded from .env.production"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    print_error "JWT_SECRET not loaded from .env.production"
    exit 1
fi

print_status "Environment variables loaded successfully"
echo "COGNITO_USER_POOL_ID: $COGNITO_USER_POOL_ID"
echo "COGNITO_CLIENT_ID: $COGNITO_CLIENT_ID"
echo "DynamoDB Table: $DYNAMODB_USERS_TABLE"

# Start the application
echo "Starting NestJS application..."
NODE_ENV=production npm run start
