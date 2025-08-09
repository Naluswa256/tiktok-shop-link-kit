#!/bin/bash

# TikTok Commerce Link Hub - Secrets Setup Script
# Usage: ./scripts/setup-secrets.sh <environment>
# Example: ./scripts/setup-secrets.sh prod

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
SECRET_PREFIX="${PROJECT_NAME}-${ENVIRONMENT}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    echo "Available environments: dev, staging, prod"
    exit 1
fi

echo "=== TikTok Commerce Link Hub Secrets Setup ==="
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Secret Prefix: $SECRET_PREFIX"
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
echo "=== Setting Up External API Secrets ==="
echo ""

# Function to prompt for secret value
prompt_secret() {
    local secret_name=$1
    local secret_description=$2
    local env_var_name=$3
    
    # Check if environment variable is set
    if [ -n "${!env_var_name}" ]; then
        log_info "Using $secret_name from environment variable $env_var_name"
        echo "${!env_var_name}"
        return
    fi
    
    # Prompt user for input
    echo -n "Enter $secret_description: "
    read -s secret_value
    echo ""
    
    if [ -z "$secret_value" ]; then
        log_warning "$secret_name not provided - you can set it later"
        echo ""
    else
        echo "$secret_value"
    fi
}

# Collect external API secrets
log_info "Collecting external API credentials..."

APIFY_TOKEN=$(prompt_secret "Apify Token" "your Apify API token" "APIFY_TOKEN")
OPENROUTER_API_KEY=$(prompt_secret "OpenRouter API Key" "your OpenRouter API key" "OPENROUTER_API_KEY")

# Create or update external APIs secret
log_info "Creating/updating external APIs secret..."

EXTERNAL_APIS_SECRET=$(cat <<EOF
{
  "apify_token": "${APIFY_TOKEN:-}",
  "openrouter_api_key": "${OPENROUTER_API_KEY:-}",
  "openai_api_key": ""
}
EOF
)

aws secretsmanager create-secret \
    --name "${SECRET_PREFIX}/external/apis" \
    --description "External API keys and tokens for ${ENVIRONMENT}" \
    --secret-string "$EXTERNAL_APIS_SECRET" \
    --region "$AWS_REGION" 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id "${SECRET_PREFIX}/external/apis" \
    --secret-string "$EXTERNAL_APIS_SECRET" \
    --region "$AWS_REGION"

log_success "External APIs secret configured"

echo ""
echo "=== Setting Up JWT Secrets ==="
echo ""

# Generate JWT secrets if not provided
log_info "Generating JWT secrets..."

JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64 | tr -d '\n')}
JWT_ADMIN_SECRET=${JWT_ADMIN_SECRET:-$(openssl rand -base64 64 | tr -d '\n')}

# Prompt for admin password
echo -n "Enter admin password (leave empty to generate): "
read -s ADMIN_PASSWORD
echo ""

if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
    log_info "Generated admin password: $ADMIN_PASSWORD"
    echo "Please save this password securely!"
fi

# Generate password hash
log_info "Generating password hash..."
ADMIN_PASSWORD_HASH=$(node -e "console.log(require('bcrypt').hashSync('$ADMIN_PASSWORD', 10))" 2>/dev/null || echo "")

if [ -z "$ADMIN_PASSWORD_HASH" ]; then
    log_warning "bcrypt not available, using simple hash (not recommended for production)"
    ADMIN_PASSWORD_HASH=$(echo -n "$ADMIN_PASSWORD" | sha256sum | cut -d' ' -f1)
fi

# Create JWT secrets
JWT_SECRETS=$(cat <<EOF
{
  "jwt_secret": "$JWT_SECRET",
  "jwt_admin_secret": "$JWT_ADMIN_SECRET",
  "admin_password_hash": "$ADMIN_PASSWORD_HASH"
}
EOF
)

aws secretsmanager create-secret \
    --name "${SECRET_PREFIX}/auth/jwt" \
    --description "JWT secrets for authentication in ${ENVIRONMENT}" \
    --secret-string "$JWT_SECRETS" \
    --region "$AWS_REGION" 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id "${SECRET_PREFIX}/auth/jwt" \
    --secret-string "$JWT_SECRETS" \
    --region "$AWS_REGION"

log_success "JWT secrets configured"

echo ""
echo "=== Setting Up Application Secrets ==="
echo ""

# Get Cognito configuration from Terraform outputs
log_info "Retrieving Cognito configuration from Terraform..."

cd "$(dirname "$0")/../infra/terraform"

if [ -f "terraform.tfstate" ]; then
    COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || echo "")
    COGNITO_CLIENT_ID=$(terraform output -raw cognito_user_pool_client_id 2>/dev/null || echo "")
    COGNITO_CLIENT_SECRET=$(terraform output -raw cognito_user_pool_client_secret 2>/dev/null || echo "")
else
    log_warning "Terraform state not found. Cognito configuration will need to be set after deployment."
    COGNITO_USER_POOL_ID=""
    COGNITO_CLIENT_ID=""
    COGNITO_CLIENT_SECRET=""
fi

# Create Cognito secret
COGNITO_SECRET=$(cat <<EOF
{
  "user_pool_id": "$COGNITO_USER_POOL_ID",
  "client_id": "$COGNITO_CLIENT_ID",
  "client_secret": "$COGNITO_CLIENT_SECRET"
}
EOF
)

aws secretsmanager create-secret \
    --name "${SECRET_PREFIX}/app/cognito" \
    --description "Cognito configuration for ${ENVIRONMENT}" \
    --secret-string "$COGNITO_SECRET" \
    --region "$AWS_REGION" 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id "${SECRET_PREFIX}/app/cognito" \
    --secret-string "$COGNITO_SECRET" \
    --region "$AWS_REGION"

log_success "Cognito secret configured"

# Create admin configuration secret
ADMIN_CONFIG=$(cat <<EOF
{
  "username": "admin@buylink.ug",
  "refresh_cookie_name": "admin_refresh_token"
}
EOF
)

aws secretsmanager create-secret \
    --name "${SECRET_PREFIX}/app/admin_config" \
    --description "Admin portal configuration for ${ENVIRONMENT}" \
    --secret-string "$ADMIN_CONFIG" \
    --region "$AWS_REGION" 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id "${SECRET_PREFIX}/app/admin_config" \
    --secret-string "$ADMIN_CONFIG" \
    --region "$AWS_REGION"

log_success "Admin configuration secret configured"

echo ""
echo "=== Secrets Setup Complete ==="
echo ""

log_success "All secrets have been configured for environment: $ENVIRONMENT"

echo ""
echo "=== Secret ARNs ==="
echo ""

# List created secrets
aws secretsmanager list-secrets \
    --query "SecretList[?starts_with(Name, '${SECRET_PREFIX}/')].{Name:Name,ARN:ARN}" \
    --output table \
    --region "$AWS_REGION"

echo ""
echo "=== Next Steps ==="
echo ""

echo "1. Verify secrets in AWS Console:"
echo "   https://console.aws.amazon.com/secretsmanager/home?region=${AWS_REGION}#/listSecrets"

echo ""
echo "2. Update Terraform variables if needed:"
echo "   export TF_VAR_apify_token=\"$APIFY_TOKEN\""
echo "   export TF_VAR_openrouter_api_key=\"$OPENROUTER_API_KEY\""

echo ""
echo "3. Re-run Terraform apply to update ECS services with secrets:"
echo "   cd infra/terraform"
echo "   terraform apply -var-file=\"envs/${ENVIRONMENT}/terraform.tfvars\""

echo ""
log_success "Secrets setup completed successfully!"
