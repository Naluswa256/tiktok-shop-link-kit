#!/bin/bash

# TikTok Commerce Authentication Infrastructure Deployment Script
# This script deploys the minimal infrastructure required for the authentication feature

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-dev}"

print_header "TikTok Commerce Authentication Infrastructure Deployment"

print_info "Script Directory: $SCRIPT_DIR"
print_info "Environment: $ENVIRONMENT"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_info "Usage: $0 [dev|staging|production]"
    exit 1
fi

# Check prerequisites
print_header "Checking Prerequisites"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed or not in PATH"
    print_info "Please install Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli"
    exit 1
fi
print_success "Terraform is installed: $(terraform version | head -n1)"

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed or not in PATH"
    print_info "Please install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi
print_success "AWS CLI is installed: $(aws --version)"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    print_info "Please configure AWS credentials: aws configure"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
print_success "AWS credentials configured for account: $AWS_ACCOUNT_ID in region: $AWS_REGION"

# Navigate to script directory
cd "$SCRIPT_DIR"

print_header "Terraform Initialization"

# Initialize Terraform
print_info "Initializing Terraform..."
if terraform init; then
    print_success "Terraform initialized successfully"
else
    print_error "Terraform initialization failed"
    exit 1
fi

print_header "Terraform Planning"

# Create Terraform plan
print_info "Creating Terraform plan for environment: $ENVIRONMENT"
if terraform plan -var-file="terraform.tfvars" -var="environment=$ENVIRONMENT" -out="terraform-${ENVIRONMENT}.tfplan"; then
    print_success "Terraform plan created successfully"
else
    print_error "Terraform planning failed"
    exit 1
fi

print_header "Infrastructure Resources to be Created"

print_info "The following resources will be created for authentication:"
echo "
📋 Authentication Infrastructure Components:

   🔐 AWS Cognito User Pool
   ├── User Pool for TikTok handle authentication
   ├── Username/password authentication flow
   ├── No MFA (simplified auth)
   └── Password policy enforcement

   🔑 AWS Cognito User Pool Client
   ├── Public client (no client secret)
   ├── USER_PASSWORD_AUTH flow enabled
   ├── REFRESH_TOKEN_AUTH flow enabled
   └── Token validity configuration

   🗄️ DynamoDB Users Table
   ├── Primary key: PK (partition), SK (sort)
   ├── GSI1: Handle lookups (GSI1PK, GSI1SK)
   ├── GSI2: Phone number lookups (GSI2PK, GSI2SK)
   ├── TTL enabled for automatic cleanup
   └── Pay-per-request billing

   🏪 DynamoDB Shops Table
   ├── Primary key: PK (partition), SK (sort)
   ├── GSI1: Handle lookups (GSI1PK, GSI1SK)
   ├── GSI2: User ID lookups (GSI2PK, GSI2SK)
   ├── TTL enabled for automatic cleanup
   └── Pay-per-request billing

   🔒 Security Features
   ├── Server-side encryption
   ├── Point-in-time recovery (production)
   └── Deletion protection (production)
"

# Confirmation prompt
print_warning "This will create AWS resources that may incur costs."
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deployment cancelled by user"
    exit 0
fi

print_header "Terraform Apply"

# Apply Terraform plan
print_info "Applying Terraform plan..."
if terraform apply "terraform-${ENVIRONMENT}.tfplan"; then
    print_success "Infrastructure deployed successfully!"
else
    print_error "Terraform apply failed"
    exit 1
fi

print_header "Deployment Outputs"

# Get Terraform outputs
print_info "Retrieving deployment outputs..."
terraform output

# Save outputs to file
terraform output -json > "deployment-outputs-${ENVIRONMENT}.json"
print_success "Outputs saved to: deployment-outputs-${ENVIRONMENT}.json"

print_header "Next Steps"

echo -e "${GREEN}🎉 Authentication infrastructure deployed successfully!${NC}\n"

print_info "To use this infrastructure:"
echo "   1. Copy the Cognito and DynamoDB configuration from the outputs"
echo "   2. Update your authentication service environment variables"
echo "   3. Add your APIFY_TOKEN to the configuration"
echo "   4. Test the authentication service"

print_info "To destroy this infrastructure:"
echo "   ./destroy.sh $ENVIRONMENT"

print_header "Deployment Complete"
print_success "Authentication infrastructure is ready for use!"
