terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure this in terraform init or backend config file
    # bucket = "buylink-us-east-1"
    # key    = "tiktok-commerce/auth/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TikTok Commerce Link Hub"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Component   = "Authentication"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  common_tags = {
    Project     = "TikTok Commerce Link Hub"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Component   = "Authentication"
  }

  # Resource naming convention
  name_prefix = "${var.project_name}-${var.environment}"
}

# AWS Cognito User Pool for TikTok Commerce Link Hub
resource "aws_cognito_user_pool" "tiktok_commerce" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # Use username (TikTok handle) as primary sign-in attribute
  # No alias attributes needed for simple username/password auth
  
  # Password policy for standard authentication
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # No MFA configuration for simplified auth
  mfa_configuration = "OFF"

  # Email configuration for password reset
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  tags = {
    Name        = "${var.project_name}-user-pool-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "tiktok_commerce_client" {
  name         = "${var.project_name}-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.tiktok_commerce.id

  # Client settings
  generate_secret = false
  
  # Auth flows - simplified for username/password authentication
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Token validity
  access_token_validity  = 1  # 1 hour
  id_token_validity     = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Simplified attributes for username/password auth
  # No special read/write attributes needed for basic auth
}

# DynamoDB table for users
resource "aws_dynamodb_table" "users" {
  name           = "${var.project_name}-users-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 for handle lookups
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI2 for phone number lookups
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # Global Secondary Index for handle lookups
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"
  }

  # Global Secondary Index for phone number lookups
  global_secondary_index {
    name     = "GSI2"
    hash_key = "GSI2PK"
    range_key = "GSI2SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup (optional)
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "production" ? true : false
  }

  # Server-side encryption (uses AWS managed key by default)
  server_side_encryption {
    enabled = true
  }

  # Deletion protection for production
  deletion_protection_enabled = var.environment == "production" ? true : false

  tags = {
    Name        = "${var.project_name}-users-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "User data storage"
  }
}

# DynamoDB table for shops
resource "aws_dynamodb_table" "shops" {
  name           = "${var.project_name}-shops-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 for handle lookups
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI2 for user ID lookups
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # Global Secondary Index for handle lookups
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"
  }

  # Global Secondary Index for user ID lookups
  global_secondary_index {
    name     = "GSI2"
    hash_key = "GSI2PK"
    range_key = "GSI2SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup (optional)
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "production" ? true : false
  }

  # Server-side encryption (uses AWS managed key by default)
  server_side_encryption {
    enabled = true
  }

  # Deletion protection for production
  deletion_protection_enabled = var.environment == "production" ? true : false

  tags = {
    Name        = "${var.project_name}-shops-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "Shop data storage"
  }
}

# Note: Using AWS managed encryption keys for simplicity
# For production, consider adding customer-managed KMS keys if needed
