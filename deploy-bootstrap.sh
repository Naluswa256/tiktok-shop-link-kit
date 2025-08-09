#!/bin/bash

# TikTok Commerce Link Hub - Infrastructure Bootstrap Script
# Usage: ./deploy-bootstrap.sh <environment>
# Example: ./deploy-bootstrap.sh prod

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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/infra/terraform"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    echo "Available environments: dev, staging, prod"
    exit 1
fi

echo "=== TikTok Commerce Link Hub Infrastructure Bootstrap ==="
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Script Directory: $SCRIPT_DIR"
log_info "Terraform Directory: $TERRAFORM_DIR"
echo ""

# Check prerequisites
echo "=== Checking Prerequisites ==="
echo ""

# Check if required tools are installed
check_tool() {
    if command -v $1 &> /dev/null; then
        local version=$($1 --version 2>&1 | head -n1)
        log_success "$1 is installed: $version"
        return 0
    else
        log_error "$1 is not installed"
        return 1
    fi
}

MISSING_TOOLS=0

check_tool terraform || MISSING_TOOLS=1
check_tool aws || MISSING_TOOLS=1
check_tool docker || MISSING_TOOLS=1
check_tool jq || MISSING_TOOLS=1

if [ $MISSING_TOOLS -eq 1 ]; then
    log_error "Missing required tools. Please install them and try again."
    exit 1
fi

# Check AWS credentials
log_info "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region)
    log_success "AWS credentials configured for account: $AWS_ACCOUNT in region: $AWS_REGION"
else
    log_error "AWS credentials not configured or invalid"
    echo "Please run 'aws configure' or set AWS environment variables"
    exit 1
fi

# Check if Terraform state bucket exists
BUCKET_NAME="buylink-terraform-state-us-east-1"
log_info "Checking Terraform state bucket: $BUCKET_NAME"

if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    log_success "Terraform state bucket exists"
else
    log_warning "Terraform state bucket does not exist. Creating..."
    
    # Create bucket
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region us-east-1
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled
    
    # Enable encryption
    aws s3api put-bucket-encryption --bucket "$BUCKET_NAME" --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
    
    # Block public access
    aws s3api put-public-access-block --bucket "$BUCKET_NAME" --public-access-block-configuration '{
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }'
    
    log_success "Terraform state bucket created and configured"
fi

# Check if DynamoDB lock table exists
LOCK_TABLE="buylink-terraform-locks"
log_info "Checking Terraform lock table: $LOCK_TABLE"

if aws dynamodb describe-table --table-name "$LOCK_TABLE" &>/dev/null; then
    log_success "Terraform lock table exists"
else
    log_warning "Terraform lock table does not exist. Creating..."
    
    aws dynamodb create-table \
        --table-name "$LOCK_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --tags Key=Project,Value=buylink Key=Purpose,Value=terraform-locks
    
    log_info "Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "$LOCK_TABLE"
    
    log_success "Terraform lock table created"
fi

echo ""
echo "=== Terraform Initialization ==="
echo ""

cd "$TERRAFORM_DIR"

# Initialize Terraform with backend configuration
log_info "Initializing Terraform with backend configuration..."
terraform init -backend-config="envs/$ENVIRONMENT/backend.hcl" -reconfigure

log_success "Terraform initialized successfully"

echo ""
echo "=== Terraform Planning ==="
echo ""

# Create Terraform plan
log_info "Creating Terraform plan for environment: $ENVIRONMENT"
terraform plan -var-file="envs/$ENVIRONMENT/terraform.tfvars" -out="$ENVIRONMENT.tfplan"

log_success "Terraform plan created successfully"

echo ""
echo "=== Terraform Apply ==="
echo ""

# Ask for confirmation before applying
if [ "$ENVIRONMENT" == "prod" ]; then
    log_warning "You are about to deploy to PRODUCTION environment!"
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
fi

# Apply Terraform plan
log_info "Applying Terraform plan..."
terraform apply "$ENVIRONMENT.tfplan"

log_success "Terraform apply completed successfully"

echo ""
echo "=== Post-Deployment Setup ==="
echo ""

# Get Terraform outputs
log_info "Retrieving Terraform outputs..."
ECR_REPOS=$(terraform output -json ecr_repository_urls)
ALB_DNS=$(terraform output -raw alb_dns_name)
APP_CONFIG=$(terraform output -json application_config)

echo ""
echo "=== Infrastructure Deployment Complete ==="
echo ""

log_success "Environment: $ENVIRONMENT"
log_success "ALB DNS Name: $ALB_DNS"

echo ""
echo "=== Next Steps ==="
echo ""

echo "1. Build and push Docker images to ECR:"
echo ""

# Extract ECR repository URLs and generate docker commands
echo "$ECR_REPOS" | jq -r 'to_entries[] | "# " + .key + "\ndocker build -t " + .value + ":latest apps/" + (.key | gsub("-"; "/")) + "/\naws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin " + (.value | split("/")[0]) + "\ndocker push " + .value + ":latest\n"'

echo ""
echo "2. Configure application secrets:"
echo "   - Set Apify token: export TF_VAR_apify_token=\"your_token\""
echo "   - Set OpenRouter API key: export TF_VAR_openrouter_api_key=\"your_key\""
echo "   - Re-run terraform apply to update secrets"

echo ""
echo "3. Test the deployment:"
echo "   curl http://$ALB_DNS/health"

echo ""
echo "4. Monitor the infrastructure:"
echo "   - CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:"
echo "   - ECS Services: https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters"

echo ""
log_success "Bootstrap deployment completed successfully!"

# Cleanup
rm -f "$ENVIRONMENT.tfplan"
