#!/bin/bash

# TikTok Commerce Authentication Infrastructure Deployment Script
# This script deploys only the authentication-related AWS resources

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="tiktok-commerce"
ENVIRONMENT="${1:-production}"
AWS_REGION="${2:-us-east-1}"

echo -e "${BLUE}🚀 TikTok Commerce Authentication Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
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

# Check prerequisites
echo -e "${BLUE}📋 Checking Prerequisites...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi
print_status "AWS CLI is installed"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed. Please install it first."
    exit 1
fi
print_status "Terraform is installed"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi
print_status "AWS credentials configured"

# Get AWS account info
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_USER=$(aws sts get-caller-identity --query Arn --output text)
print_status "Connected to AWS Account: ${AWS_ACCOUNT_ID}"
print_status "Using AWS User/Role: ${AWS_USER}"

echo ""

# Check SMS configuration
echo -e "${BLUE}📱 Checking SMS Configuration...${NC}"

# Check SNS SMS attributes
SMS_LIMIT=$(aws sns get-account-attributes --query 'Attributes.MonthlySpendLimit' --output text 2>/dev/null || echo "Not set")
if [ "$SMS_LIMIT" = "Not set" ] || [ "$SMS_LIMIT" = "1.00" ]; then
    print_warning "SMS spending limit is low ($SMS_LIMIT). Consider increasing it for production."
    echo "   Run: aws sns set-sms-attributes --attributes MonthlySpendLimit=10.00"
else
    print_status "SMS spending limit: $SMS_LIMIT"
fi

echo ""

# Prepare Lambda functions
echo -e "${BLUE}📦 Preparing Lambda Functions...${NC}"

cd lambda-functions

# Create zip files for Lambda functions
for func in create-auth-challenge define-auth-challenge verify-auth-challenge; do
    if [ -d "$func" ]; then
        echo "Packaging $func..."
        cd "$func"
        zip -q "../${func}.zip" index.js
        cd ..
        print_status "Packaged $func"
    else
        print_error "Lambda function directory $func not found"
        exit 1
    fi
done

# Create placeholder zip for Terraform
echo "exports.handler = async (event) => { return event; };" > placeholder.js
zip -q lambda-placeholder.zip placeholder.js
rm placeholder.js
print_status "Created placeholder Lambda package"

cd ..

echo ""

# Initialize Terraform
echo -e "${BLUE}🏗️ Initializing Terraform...${NC}"

terraform init
print_status "Terraform initialized"

# Validate Terraform configuration
terraform validate
print_status "Terraform configuration validated"

# Format Terraform files
terraform fmt
print_status "Terraform files formatted"

echo ""

# Create terraform.tfvars if it doesn't exist
if [ ! -f "terraform.tfvars" ]; then
    echo -e "${BLUE}📝 Creating terraform.tfvars...${NC}"
    cat > terraform.tfvars << EOF
project_name = "${PROJECT_NAME}"
environment = "${ENVIRONMENT}"
aws_region = "${AWS_REGION}"
alert_email = "naluswawilliam68@gmail.com"
EOF
    print_status "Created terraform.tfvars"
    print_warning "Please update terraform.tfvars with your actual email address"
fi

# Plan deployment
echo -e "${BLUE}📋 Planning Deployment...${NC}"

terraform plan -var-file=terraform.tfvars -out=auth.tfplan
print_status "Terraform plan created"

echo ""
echo -e "${YELLOW}📊 Review the plan above carefully.${NC}"
echo -e "${YELLOW}The following resources will be created:${NC}"
echo -e "${YELLOW}  - DynamoDB table for users${NC}"
echo -e "${YELLOW}  - Cognito User Pool and Client${NC}"
echo -e "${YELLOW}  - Lambda functions for auth flow${NC}"
echo -e "${YELLOW}  - IAM roles and policies${NC}"
echo ""

# Confirm deployment
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Apply Terraform
echo -e "${BLUE}🚀 Deploying Infrastructure...${NC}"

terraform apply auth.tfplan
print_status "Infrastructure deployed successfully"

echo ""

# Update Lambda function code
echo -e "${BLUE}🔄 Updating Lambda Functions...${NC}"

# Get function names from Terraform output
CREATE_FUNCTION=$(terraform output -raw create_auth_challenge_function_name 2>/dev/null || echo "${PROJECT_NAME}-create-auth-challenge-${ENVIRONMENT}")
DEFINE_FUNCTION=$(terraform output -raw define_auth_challenge_function_name 2>/dev/null || echo "${PROJECT_NAME}-define-auth-challenge-${ENVIRONMENT}")
VERIFY_FUNCTION=$(terraform output -raw verify_auth_challenge_function_name 2>/dev/null || echo "${PROJECT_NAME}-verify-auth-challenge-${ENVIRONMENT}")

# Update Lambda function code
cd lambda-functions

aws lambda update-function-code \
    --function-name "$CREATE_FUNCTION" \
    --zip-file fileb://create-auth-challenge.zip > /dev/null
print_status "Updated create-auth-challenge function"

aws lambda update-function-code \
    --function-name "$DEFINE_FUNCTION" \
    --zip-file fileb://define-auth-challenge.zip > /dev/null
print_status "Updated define-auth-challenge function"

aws lambda update-function-code \
    --function-name "$VERIFY_FUNCTION" \
    --zip-file fileb://verify-auth-challenge.zip > /dev/null
print_status "Updated verify-auth-challenge function"

cd ..

echo ""

# Get outputs
echo -e "${BLUE}📤 Deployment Outputs:${NC}"

COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
DYNAMODB_TABLE_NAME=$(terraform output -raw dynamodb_users_table_name)

echo -e "${GREEN}Cognito User Pool ID:${NC} $COGNITO_USER_POOL_ID"
echo -e "${GREEN}Cognito Client ID:${NC} $COGNITO_CLIENT_ID"
echo -e "${GREEN}DynamoDB Table Name:${NC} $DYNAMODB_TABLE_NAME"
echo -e "${GREEN}AWS Region:${NC} $AWS_REGION"

echo ""

# Save outputs to file
cat > deployment-outputs.env << EOF
# TikTok Commerce Authentication - Deployment Outputs
# Generated on $(date)

COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
DYNAMODB_USERS_TABLE=$DYNAMODB_TABLE_NAME
AWS_REGION=$AWS_REGION
EOF

print_status "Outputs saved to deployment-outputs.env"

echo ""

# Test deployment
echo -e "${BLUE}🧪 Testing Deployment...${NC}"

# Test DynamoDB table
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE_NAME" > /dev/null 2>&1; then
    print_status "DynamoDB table is accessible"
else
    print_error "DynamoDB table is not accessible"
fi

# Test Cognito User Pool
if aws cognito-idp describe-user-pool --user-pool-id "$COGNITO_USER_POOL_ID" > /dev/null 2>&1; then
    print_status "Cognito User Pool is accessible"
else
    print_error "Cognito User Pool is not accessible"
fi

# Test Lambda functions
for func in "$CREATE_FUNCTION" "$DEFINE_FUNCTION" "$VERIFY_FUNCTION"; do
    if aws lambda get-function --function-name "$func" > /dev/null 2>&1; then
        print_status "Lambda function $func is accessible"
    else
        print_error "Lambda function $func is not accessible"
    fi
done

echo ""

# Next steps
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. Update your application's environment variables:"
echo "   COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID"
echo "   COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID"
echo "   DYNAMODB_USERS_TABLE=$DYNAMODB_TABLE_NAME"
echo ""
echo "2. Configure your application secrets (JWT_SECRET, APIFY_TOKEN, etc.)"
echo ""
echo "3. Deploy your NestJS application with the new configuration"
echo ""
echo "4. Test the authentication endpoints:"
echo "   POST /auth/validate-handle"
echo "   POST /auth/signup"
echo "   POST /auth/verify-signup"
echo ""

print_status "Authentication infrastructure deployment completed successfully!"

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
