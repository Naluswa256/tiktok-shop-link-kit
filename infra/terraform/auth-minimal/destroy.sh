#!/bin/bash

# TikTok Commerce Authentication Infrastructure Cleanup Script
# This script destroys the authentication infrastructure resources

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

print_header "TikTok Commerce Authentication Infrastructure Cleanup"

print_info "Script Directory: $SCRIPT_DIR"
print_info "Environment: $ENVIRONMENT"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_info "Usage: $0 [dev|staging|production]"
    exit 1
fi

# Navigate to script directory
cd "$SCRIPT_DIR"

print_header "Resources to be Destroyed"

print_warning "The following resources will be PERMANENTLY DELETED:"
echo "
🗑️ Resources to be destroyed:
   
   🔐 AWS Cognito User Pool
   ├── All user accounts will be deleted
   ├── User pool configuration will be lost
   └── Cannot be recovered after deletion
   
   🔑 AWS Cognito User Pool Client
   ├── Client configuration will be deleted
   └── API access will be revoked
   
   🗄️ DynamoDB Users Table
   ├── ALL USER DATA will be permanently deleted
   ├── Table structure will be removed
   ├── GSI indexes will be deleted
   └── ⚠️  THIS CANNOT BE UNDONE ⚠️
   
   🔒 Security Resources
   ├── KMS keys (if production)
   └── IAM roles and policies
"

print_error "⚠️  WARNING: This action is IRREVERSIBLE!"
print_error "⚠️  All user data will be permanently lost!"

if [[ "$ENVIRONMENT" == "production" ]]; then
    print_error "⚠️  YOU ARE ABOUT TO DESTROY PRODUCTION RESOURCES!"
    print_error "⚠️  This will affect live users and services!"
fi

# Double confirmation for production
if [[ "$ENVIRONMENT" == "production" ]]; then
    print_warning "Production environment detected. Extra confirmation required."
    read -p "Type 'DELETE PRODUCTION' to confirm: " confirmation
    if [[ "$confirmation" != "DELETE PRODUCTION" ]]; then
        print_info "Destruction cancelled - confirmation text did not match"
        exit 0
    fi
fi

# Final confirmation
read -p "Are you absolutely sure you want to destroy all authentication infrastructure? (type 'yes' to confirm): " final_confirmation
if [[ "$final_confirmation" != "yes" ]]; then
    print_info "Destruction cancelled by user"
    exit 0
fi

print_header "Terraform Destroy"

# Create destroy plan
print_info "Creating destruction plan..."
if terraform plan -destroy -var-file="terraform.tfvars" -var="environment=$ENVIRONMENT" -out="destroy-${ENVIRONMENT}.tfplan"; then
    print_success "Destruction plan created successfully"
else
    print_error "Failed to create destruction plan"
    exit 1
fi

# Apply destroy plan
print_info "Destroying infrastructure..."
if terraform apply "destroy-${ENVIRONMENT}.tfplan"; then
    print_success "Infrastructure destroyed successfully"
else
    print_error "Failed to destroy infrastructure"
    exit 1
fi

# Clean up plan files
rm -f "destroy-${ENVIRONMENT}.tfplan" "terraform-${ENVIRONMENT}.tfplan"

print_header "Cleanup Complete"

print_success "All authentication infrastructure has been destroyed"
print_info "Configuration files are preserved in case you need to redeploy"

print_info "Cleanup completed successfully"
