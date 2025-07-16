# Production Authentication Setup Guide

This document provides step-by-step instructions for setting up the authentication feature in production, including AWS console configuration and Terraform deployment.

## 📋 Table of Contents

- [AWS Console Prerequisites](#aws-console-prerequisites)
- [Required AWS Services](#required-aws-services)
- [AWS Console Configuration](#aws-console-configuration)
- [Terraform Configuration](#terraform-configuration)
- [Environment Setup](#environment-setup)
- [Deployment Steps](#deployment-steps)
- [Testing & Validation](#testing--validation)
- [Troubleshooting](#troubleshooting)

## 🔧 AWS Console Prerequisites

### 1. AWS Account Setup

#### Required Permissions
Create an IAM user or role with the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*",
        "dynamodb:*",
        "lambda:*",
        "iam:*",
        "sns:*",
        "logs:*",
        "kms:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### AWS CLI Configuration
```bash
# Configure AWS CLI with your credentials
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

### 2. Region Selection
- **Recommended**: `us-east-1` (N. Virginia) for lowest latency
- **Alternative**: `us-west-2` (Oregon) for west coast users
- **Note**: Cognito SMS is available in most regions

## 🏗️ Required AWS Services

The authentication feature uses these AWS services:

### Core Services
1. **AWS Cognito User Pool** - User management and SMS OTP
2. **DynamoDB** - User data storage
3. **Lambda** - Custom auth flow triggers
4. **IAM** - Roles and permissions
5. **SNS** - SMS delivery (via Cognito)
6. **CloudWatch** - Logging and monitoring

### Optional Services (for production)
7. **KMS** - Encryption keys
8. **CloudTrail** - Audit logging
9. **Route 53** - DNS management
10. **ACM** - SSL certificates

## ⚙️ AWS Console Configuration

### 1. Enable Required Services

#### Navigate to each service and ensure they're available:
```bash
# Check service availability in your region
aws cognito-idp list-user-pools --max-items 1
aws dynamodb list-tables --limit 1
aws lambda list-functions --max-items 1
aws sns list-topics
```

### 2. SMS Configuration (Critical for OTP)

#### Set SMS Spending Limit
1. Go to **SNS Console** → **Text messaging (SMS)** → **Account attributes**
2. Set **Monthly spending limit**: `$10.00` (adjust as needed)
3. Set **Default message type**: `Transactional`
4. **Important**: Request SMS spending limit increase if needed

#### Verify SMS Sandbox (if applicable)
1. Go to **SNS Console** → **Text messaging (SMS)** → **Sandbox**
2. If in sandbox mode, add test phone numbers
3. For production, request to move out of sandbox

### 3. Lambda Execution Role Setup

#### Create Lambda Execution Role (if not using Terraform)
1. Go to **IAM Console** → **Roles** → **Create role**
2. Select **AWS service** → **Lambda**
3. Attach policies:
   - `AWSLambdaBasicExecutionRole`
   - Custom policy for Cognito triggers:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### 4. KMS Key for Encryption (Production)

#### Create KMS Key
1. Go to **KMS Console** → **Customer managed keys** → **Create key**
2. Key type: **Symmetric**
3. Key usage: **Encrypt and decrypt**
4. Alias: `tiktok-commerce-production`
5. Add key administrators and users

## 🏗️ Terraform Configuration

### 1. Create Terraform Variables File

Create `infra/terraform/production.tfvars`:

```hcl
# Project Configuration
project_name = "tiktok-commerce"
environment = "production"
aws_region = "us-east-1"

# Domain Configuration
domain_name = "your-domain.com"
subdomain = "api"

# Cognito Configuration
cognito_sms_external_id = "tiktok-commerce-external-id-production"

# Security Configuration
enable_encryption = true
enable_deletion_protection = true
enable_point_in_time_recovery = true

# Monitoring Configuration
enable_monitoring = true
enable_detailed_monitoring = true
alert_email = "admin@your-domain.com"

# API Keys (will be set via environment variables)
# apify_token = "set-via-env"
# openai_api_key = "set-via-env"

# Cost Optimization
enable_cost_optimization = true

# Additional Tags
additional_tags = {
  Owner = "DevOps Team"
  CostCenter = "Engineering"
  Backup = "Required"
}
```

### 2. Create Auth-Only Terraform Configuration

Create `infra/terraform/auth-only.tf`:

```hcl
# This file contains only authentication-related resources
# Use this for initial auth feature deployment

# Include only these modules/resources:
# - cognito.tf (User Pool and Lambda triggers)
# - dynamodb.tf (Users table only)
# - variables.tf
# - outputs.tf

# Comment out or exclude:
# - ECS/Fargate resources
# - Load balancers
# - Other application infrastructure
```

### 3. Minimal Terraform Deployment

Create `infra/terraform/auth-minimal/main.tf`:

```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }
}

# Include only authentication resources
module "cognito" {
  source = "../cognito.tf"
  # Pass required variables
}

module "dynamodb_users" {
  source = "../dynamodb.tf"
  # Pass required variables
}
```

## 🔐 Environment Setup

### 1. Production Environment Variables

Create `apps/ingestion-api/.env.production`:

```bash
# Application Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# AWS Configuration
AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY will be set via IAM roles

# DynamoDB Configuration (from Terraform outputs)
DYNAMODB_USERS_TABLE=tiktok-commerce-users-production

# AWS Cognito Configuration (from Terraform outputs)
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_REGION=us-east-1

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=1h

# Apify Configuration
APIFY_TOKEN=your-production-apify-token
APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper
APIFY_TIMEOUT=60

# Security Configuration
BCRYPT_ROUNDS=12
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
ENABLE_METRICS=true
ENABLE_TRACING=true
SENTRY_DSN=your-sentry-dsn-for-error-tracking

# Feature Flags
ENABLE_HANDLE_VALIDATION=true
ENABLE_SUBSCRIPTION_CHECK=true
ENABLE_ANALYTICS=true
```

### 2. Secrets Management

#### Store sensitive values in AWS Secrets Manager:

```bash
# Create secrets
aws secretsmanager create-secret \
  --name "tiktok-commerce/production/api-keys" \
  --description "API keys for production environment" \
  --secret-string '{
    "jwt_secret": "your-jwt-secret",
    "apify_token": "your-apify-token",
    "openai_api_key": "your-openai-key"
  }'

# Verify secret creation
aws secretsmanager describe-secret \
  --secret-id "tiktok-commerce/production/api-keys"
```

## 🚀 Deployment Steps

### Step 1: Prepare Terraform

```bash
# Navigate to Terraform directory
cd infra/terraform

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Format configuration files
terraform fmt
```

### Step 2: Plan Deployment

```bash
# Create execution plan
terraform plan \
  -var-file=production.tfvars \
  -out=production.tfplan

# Review the plan carefully
# Ensure only auth-related resources are being created
```

### Step 3: Deploy Infrastructure

```bash
# Apply the plan
terraform apply production.tfplan

# Or apply directly (with confirmation)
terraform apply -var-file=production.tfvars
```

### Step 4: Capture Terraform Outputs

```bash
# Get important outputs
terraform output cognito_user_pool_id
terraform output cognito_client_id
terraform output dynamodb_users_table_name

# Save outputs to file
terraform output -json > terraform-outputs.json
```

### Step 5: Update Environment Variables

```bash
# Update .env.production with Terraform outputs
COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
DYNAMODB_USERS_TABLE=$(terraform output -raw dynamodb_users_table_name)

# Update your .env.production file with these values
```

### Step 6: Deploy Lambda Functions

```bash
# Package Lambda functions (if not automated)
cd lambda-functions
zip -r create-auth-challenge.zip create-auth-challenge/
zip -r define-auth-challenge.zip define-auth-challenge/
zip -r verify-auth-challenge.zip verify-auth-challenge/

# Upload to Lambda (if not done by Terraform)
aws lambda update-function-code \
  --function-name tiktok-commerce-create-auth-challenge-production \
  --zip-file fileb://create-auth-challenge.zip
```

### Step 7: Test Infrastructure

```bash
# Test DynamoDB table
aws dynamodb describe-table \
  --table-name tiktok-commerce-users-production

# Test Cognito User Pool
aws cognito-idp describe-user-pool \
  --user-pool-id $(terraform output -raw cognito_user_pool_id)

# Test Lambda functions
aws lambda invoke \
  --function-name tiktok-commerce-create-auth-challenge-production \
  --payload '{}' \
  response.json
```

## 🧪 Testing & Validation

### 1. Infrastructure Testing

```bash
# Test DynamoDB connectivity
aws dynamodb put-item \
  --table-name tiktok-commerce-users-production \
  --item '{
    "PK": {"S": "TEST#123"},
    "SK": {"S": "TEST#123"},
    "EntityType": {"S": "TEST"}
  }'

# Clean up test item
aws dynamodb delete-item \
  --table-name tiktok-commerce-users-production \
  --key '{"PK": {"S": "TEST#123"}, "SK": {"S": "TEST#123"}}'
```

### 2. Cognito Testing

```bash
# Test user creation (replace with real phone number)
aws cognito-idp admin-create-user \
  --user-pool-id $(terraform output -raw cognito_user_pool_id) \
  --username "+1234567890" \
  --user-attributes Name=phone_number,Value="+1234567890" \
  --message-action SUPPRESS

# Clean up test user
aws cognito-idp admin-delete-user \
  --user-pool-id $(terraform output -raw cognito_user_pool_id) \
  --username "+1234567890"
```

### 3. Application Testing

```bash
# Build and test the application
cd apps/ingestion-api

# Install dependencies
npm install

# Run tests
npm run test

# Start application (ensure .env.production is configured)
NODE_ENV=production npm run start
```

### 4. API Endpoint Testing

```bash
# Test health endpoint
curl https://your-api-domain.com/health

# Test handle validation
curl -X POST https://your-api-domain.com/auth/validate-handle \
  -H "Content-Type: application/json" \
  -d '{"handle": "testuser123"}'

# Test signup initiation
curl -X POST https://your-api-domain.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "testuser123",
    "phoneNumber": "+1234567890"
  }'
```

## 🚨 Troubleshooting

### Common Issues

#### 1. SMS Not Working
```bash
# Check SNS configuration
aws sns get-sms-attributes

# Check spending limit
aws sns get-account-attributes

# Verify phone number format (E.164)
# Correct: +1234567890
# Incorrect: 1234567890, (123) 456-7890
```

#### 2. Lambda Function Errors
```bash
# Check Lambda logs
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/tiktok-commerce"

# View recent logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/tiktok-commerce-create-auth-challenge-production" \
  --start-time $(date -d '1 hour ago' +%s)000
```

#### 3. DynamoDB Access Issues
```bash
# Check table status
aws dynamodb describe-table \
  --table-name tiktok-commerce-users-production

# Verify IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT:role/ROLE_NAME \
  --action-names dynamodb:GetItem \
  --resource-arns arn:aws:dynamodb:us-east-1:ACCOUNT:table/tiktok-commerce-users-production
```

#### 4. Terraform Issues
```bash
# Check Terraform state
terraform show

# Refresh state
terraform refresh -var-file=production.tfvars

# Import existing resources (if needed)
terraform import aws_cognito_user_pool.tiktok_commerce us-east-1_XXXXXXXXX
```

### Monitoring Setup

#### CloudWatch Alarms
```bash
# Create alarm for DynamoDB throttling
aws cloudwatch put-metric-alarm \
  --alarm-name "DynamoDB-Users-Throttles" \
  --alarm-description "DynamoDB throttling alarm" \
  --metric-name ThrottledRequests \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=tiktok-commerce-users-production
```

## 📊 Production Checklist

### Pre-Deployment
- [ ] AWS account configured with proper permissions
- [ ] SMS spending limits set and sandbox mode disabled
- [ ] Domain name and SSL certificates ready
- [ ] Secrets stored in AWS Secrets Manager
- [ ] Terraform configuration validated
- [ ] Environment variables configured

### Post-Deployment
- [ ] All Terraform resources created successfully
- [ ] DynamoDB table accessible and functional
- [ ] Cognito User Pool configured correctly
- [ ] Lambda functions deployed and working
- [ ] SMS OTP delivery working
- [ ] API endpoints responding correctly
- [ ] Monitoring and alarms configured
- [ ] Backup and recovery procedures tested

### Security Verification
- [ ] IAM roles follow least privilege principle
- [ ] Encryption enabled for data at rest
- [ ] HTTPS enforced for all API calls
- [ ] Rate limiting configured
- [ ] Input validation working
- [ ] Error messages don't leak sensitive information

This guide provides everything needed to deploy the authentication feature to production successfully!
