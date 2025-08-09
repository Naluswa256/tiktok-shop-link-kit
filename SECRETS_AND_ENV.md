# TikTok Commerce Link Hub - Secrets and Environment Configuration

## Overview

This document provides comprehensive guidance on managing secrets and environment variables for the TikTok Commerce Link Hub across different environments.

## Security Architecture

### **Two-Tier Configuration System**

1. **AWS Secrets Manager**: Sensitive data (API keys, passwords, tokens)
2. **AWS Systems Manager Parameter Store**: Non-sensitive configuration values
3. **Environment Variables**: Runtime configuration in containers

### **Security Principles**

- ✅ **No hardcoded secrets** in code or configuration files
- ✅ **Environment-specific isolation** of secrets and configuration
- ✅ **Least privilege access** via IAM roles
- ✅ **Encryption at rest** for all sensitive data
- ✅ **Audit logging** for secret access

## Secrets Management

### **AWS Secrets Manager Structure**

```
buylink-{environment}/
├── external/apis          # External API keys
├── auth/jwt              # JWT secrets and admin credentials
├── app/cognito           # Cognito configuration
└── app/admin_config      # Admin portal settings
```

### **Secret Categories**

#### 1. External APIs (`external/apis`)
```json
{
  "apify_token": "your_apify_api_token",
  "openrouter_api_key": "your_openrouter_api_key",
  "openai_api_key": "optional_openai_key"
}
```

#### 2. Authentication (`auth/jwt`)
```json
{
  "jwt_secret": "base64_encoded_secret_64_chars",
  "jwt_admin_secret": "base64_encoded_admin_secret_64_chars",
  "admin_password_hash": "bcrypt_hashed_password"
}
```

#### 3. Cognito Configuration (`app/cognito`)
```json
{
  "user_pool_id": "us-east-1_XXXXXXXXX",
  "client_id": "cognito_client_id",
  "client_secret": "cognito_client_secret"
}
```

#### 4. Admin Configuration (`app/admin_config`)
```json
{
  "username": "admin@buylink.ug",
  "refresh_cookie_name": "admin_refresh_token"
}
```

## Environment Variables

### **Service-Specific Configuration**

#### **Ingestion API**
```bash
# Application
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# AWS Resources (from Terraform)
DYNAMODB_USERS_TABLE=buylink-prod-users
DYNAMODB_SHOPS_TABLE=buylink-prod-shops
DYNAMODB_PRODUCTS_TABLE=buylink-prod-products
DYNAMODB_ADMIN_SESSIONS_TABLE=buylink-prod-admin-sessions
DYNAMODB_INGESTION_STATE_TABLE=buylink-prod-ingestion-state
SNS_NEW_VIDEO_POSTED_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:buylink-prod-new-video-posted
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX

# Secrets (from Secrets Manager)
COGNITO_CLIENT_ID=<from-secrets-manager>
JWT_SECRET=<from-secrets-manager>
JWT_SECRET_ADMIN=<from-secrets-manager>
ADMIN_PASSWORD_HASH=<from-secrets-manager>
APIFY_TOKEN=<from-secrets-manager>
```

#### **Product Service**
```bash
# Application
NODE_ENV=production
PORT=3002
LOG_LEVEL=info

# AWS Resources
DYNAMODB_PRODUCTS_TABLE=buylink-prod-products
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/buylink-prod-product-assembly
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:buylink-prod-new-video-posted
```

#### **Thumbnail Generator**
```bash
# Application
NODE_ENV=production
LOG_LEVEL=info

# AWS Resources
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/buylink-prod-thumbnail-generation
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:buylink-prod-new-video-posted
S3_BUCKET_NAME=buylink-prod-thumbnails

# Processing Configuration
MAX_VIDEO_SIZE_MB=300
MAX_VIDEO_DURATION_SECONDS=3600
THUMBNAILS_TO_GENERATE=5
YOLO_MODEL_PATH=yolov8n.pt
```

#### **Caption Parser**
```bash
# Application
NODE_ENV=production
LOG_LEVEL=info

# AWS Resources
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/buylink-prod-caption-parsing
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:buylink-prod-new-video-posted

# LLM Configuration
LLM_PROVIDER=openrouter
LLM_MODEL=microsoft/phi-3-mini-128k-instruct

# Secrets (from Secrets Manager)
OPENROUTER_API_KEY=<from-secrets-manager>
```

## Setup Instructions

### **1. Initial Secrets Setup**

```bash
# Set environment variables for secrets
export APIFY_TOKEN="your_apify_token"
export OPENROUTER_API_KEY="your_openrouter_key"

# Run secrets setup script
./scripts/setup-secrets.sh prod
```

### **2. Environment Configuration**

```bash
# Configure environment variables from Terraform outputs
./scripts/configure-environment.sh prod
```

### **3. Manual Secret Updates**

```bash
# Update external APIs secret
aws secretsmanager update-secret \
  --secret-id "buylink-prod/external/apis" \
  --secret-string '{
    "apify_token": "new_token",
    "openrouter_api_key": "new_key"
  }'

# Update JWT secrets
aws secretsmanager update-secret \
  --secret-id "buylink-prod/auth/jwt" \
  --secret-string '{
    "jwt_secret": "new_jwt_secret",
    "jwt_admin_secret": "new_admin_secret",
    "admin_password_hash": "new_bcrypt_hash"
  }'
```

## Development Workflow

### **Local Development**

1. **Copy environment templates:**
   ```bash
   cp apps/ingestion-api/.env.example apps/ingestion-api/.env
   cp apps/product-service/.env.example apps/product-service/.env
   cp apps/ai-workers/thumbnail-generator/.env.example apps/ai-workers/thumbnail-generator/.env
   cp apps/ai-workers/caption-parser/.env.example apps/ai-workers/caption-parser/.env
   ```

2. **Configure local AWS credentials:**
   ```bash
   aws configure
   # or
   export AWS_ACCESS_KEY_ID="your_key"
   export AWS_SECRET_ACCESS_KEY="your_secret"
   export AWS_DEFAULT_REGION="us-east-1"
   ```

3. **Update .env files** with development values

### **Environment Promotion**

```bash
# Development → Staging
./scripts/setup-secrets.sh staging
./scripts/configure-environment.sh staging

# Staging → Production
./scripts/setup-secrets.sh prod
./scripts/configure-environment.sh prod
```

## Security Best Practices

### **Secret Rotation**

1. **Automated Rotation** (recommended for production):
   ```bash
   # Enable automatic rotation for database secrets
   aws secretsmanager update-secret \
     --secret-id "buylink-prod/database/credentials" \
     --rotation-rules AutomaticallyAfterDays=30
   ```

2. **Manual Rotation**:
   ```bash
   # Generate new JWT secrets
   NEW_JWT_SECRET=$(openssl rand -base64 64)
   NEW_ADMIN_SECRET=$(openssl rand -base64 64)
   
   # Update secret
   aws secretsmanager update-secret \
     --secret-id "buylink-prod/auth/jwt" \
     --secret-string "{
       \"jwt_secret\": \"$NEW_JWT_SECRET\",
       \"jwt_admin_secret\": \"$NEW_ADMIN_SECRET\",
       \"admin_password_hash\": \"existing_hash\"
     }"
   ```

### **Access Control**

1. **IAM Roles** (not users) for service access
2. **Least privilege** - services only access required secrets
3. **Environment isolation** - prod secrets not accessible from dev
4. **Audit logging** - CloudTrail logs all secret access

### **Monitoring**

1. **CloudWatch Alarms** for unusual secret access patterns
2. **AWS Config** for compliance monitoring
3. **Cost monitoring** for Secrets Manager usage

## Troubleshooting

### **Common Issues**

1. **Secret Not Found**
   ```bash
   # Check if secret exists
   aws secretsmanager describe-secret --secret-id "buylink-prod/external/apis"
   
   # List all secrets
   aws secretsmanager list-secrets --query "SecretList[?starts_with(Name, 'buylink-prod/')].Name"
   ```

2. **Permission Denied**
   ```bash
   # Check IAM role permissions
   aws sts get-caller-identity
   
   # Test secret access
   aws secretsmanager get-secret-value --secret-id "buylink-prod/external/apis"
   ```

3. **Environment Variables Not Loading**
   - Check ECS task definition
   - Verify IAM role has `secretsmanager:GetSecretValue` permission
   - Check CloudWatch logs for error messages

### **Debugging Commands**

```bash
# List all secrets for environment
aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'buylink-prod/')].{Name:Name,LastChanged:LastChangedDate}" \
  --output table

# Get secret value (be careful with sensitive data)
aws secretsmanager get-secret-value \
  --secret-id "buylink-prod/external/apis" \
  --query "SecretString" \
  --output text | jq .

# Check parameter store values
aws ssm get-parameters-by-path \
  --path "/buylink-prod/" \
  --recursive \
  --query "Parameters[].{Name:Name,Value:Value}" \
  --output table
```

## Environment-Specific Configurations

### **Development**
- Local .env files
- Shared development secrets
- Relaxed security for debugging

### **Staging**
- Production-like configuration
- Separate secrets from production
- Testing secret rotation

### **Production**
- Strict security controls
- Automated secret rotation
- Comprehensive monitoring

---

**Security Note**: Never commit .env files or expose secrets in logs, error messages, or version control.

**Last Updated**: 2024-01-09
**Version**: 1.0.0
