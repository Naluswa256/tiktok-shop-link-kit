# TikTok Commerce Link Hub - Authentication Module

This document provides comprehensive instructions for deploying and testing the passwordless authentication system for the TikTok Commerce Link Hub.

## 🏗️ Architecture Overview

The authentication system implements a passwordless signup/signin flow using:

- **AWS Cognito User Pool** for user management and SMS OTP
- **TikTok Handle Validation** via Apify TikTok Profile Scraper
- **DynamoDB** for user data storage with GSI for efficient lookups
- **JWT Tokens** for session management
- **Subscription-based Access Control** for premium features

## 📋 Prerequisites

### Required Services
- AWS Account with appropriate permissions
- Apify account for TikTok handle validation
- Node.js 18+ and npm
- Terraform 1.0+ installed
- AWS CLI configured

### AWS IAM Setup for Terraform

#### Step 1: Create IAM User for Terraform
1. **Go to AWS Console** → IAM → Users → Create User
2. **User name**: `terraform-tiktok-commerce`
3. **Access type**: Programmatic access (Access key)
4. **Don't attach policies yet** - we'll create a custom policy

#### Step 2: Create Custom IAM Policy
1. **Go to IAM** → Policies → Create Policy
2. **Policy name**: `TerraformTikTokCommercePolicy`
3. **Use this JSON policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*",
        "dynamodb:*",
        "iam:*",
        "s3:*",
        "kms:*",
        "logs:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "sts:AssumeRole"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Step 3: Attach Policy to User
1. **Go to IAM** → Users → `terraform-tiktok-commerce`
2. **Permissions** → Add permissions → Attach policies directly
3. **Select**: `TerraformTikTokCommercePolicy`
4. **Click**: Add permissions

#### Step 4: Create Access Keys
1. **Go to IAM** → Users → `terraform-tiktok-commerce`
2. **Security credentials** → Create access key
3. **Use case**: Command Line Interface (CLI)
4. **Download** or copy the Access Key ID and Secret Access Key
5. **⚠️ Important**: Save these securely - you won't see the secret again

#### Step 5: Configure AWS CLI
```bash
# Configure AWS CLI with Terraform user credentials
aws configure
# AWS Access Key ID: [Your Terraform user access key]
# AWS Secret Access Key: [Your Terraform user secret key]
# Default region name: ap-southeast-3  # Or your preferred region
# Default output format: json

# Verify configuration works
aws sts get-caller-identity
```

#### Step 6: Create S3 Bucket for Terraform State
```bash
# Create bucket for Terraform state (replace 'your-unique-bucket-name')
aws s3 mb s3://your-terraform-state-bucket-name --region ap-southeast-3

# Enable versioning for state file safety
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket-name \
  --versioning-configuration Status=Enabled
```

## 🚀 Deployment Instructions

### 1. Infrastructure Deployment

#### Option A: Automated Deployment (Recommended)
```bash
# Use the automated deployment script
./scripts/deploy-auth-infrastructure.sh dev

# The script will:
# 1. Check prerequisites (Terraform, AWS CLI, credentials)
# 2. Initialize Terraform
# 3. Create deployment plan
# 4. Show you what resources will be created
# 5. Deploy infrastructure after confirmation
# 6. Generate environment configuration file
```

#### Option B: Manual Terraform Deployment
```bash
# Navigate to terraform directory
cd infra/terraform

# Initialize Terraform with your S3 backend
terraform init \
  -backend-config="bucket=your-terraform-state-bucket-name" \
  -backend-config="key=tiktok-commerce/dev/terraform.tfstate" \
  -backend-config="region=ap-southeast-3"

# Create terraform.tfvars file
cat > dev.tfvars << EOF
project_name = "tiktok-commerce"
environment = "dev"
aws_region = "ap-southeast-3"
domain_name = "your-domain.com"
notification_email = "admin@your-domain.com"
apify_token = "your-apify-token-here"
EOF

# Plan deployment
terraform plan -var-file=dev.tfvars

# Deploy infrastructure
terraform apply -var-file=dev.tfvars
```

#### Get Terraform Outputs
```bash
# Get Cognito configuration
terraform output cognito_user_pool_id
terraform output cognito_client_id

# Get DynamoDB table names
terraform output dynamodb_users_table_name

# Save all outputs to file
terraform output -json > deployment-outputs.json
```

### 2. Application Configuration

#### Environment Variables
```bash
# Copy example environment file
cp apps/ingestion-api/.env.example apps/ingestion-api/.env

# Update with your values
nano apps/ingestion-api/.env
```

#### Required Environment Variables
```bash
# AWS Cognito (from Terraform outputs)
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret  # Required if app client has secret

# DynamoDB (from Terraform outputs)
DYNAMODB_USERS_TABLE=tiktok-users-dev

# JWT Secret (generate a secure key)
JWT_SECRET=$(openssl rand -base64 32)

# Apify Token (from your Apify account)
APIFY_TOKEN=your-apify-token-here
```

### 3. Install Dependencies

```bash
# Install root dependencies
npm install

# Install ingestion-api dependencies
cd apps/ingestion-api
npm install

# Install required packages for auth
npm install @aws-sdk/client-cognito-identity-provider
npm install @aws-sdk/client-dynamodb
npm install @aws-sdk/util-dynamodb
npm install @nestjs/jwt
npm install @nestjs/config
npm install apify-client
npm install class-validator
npm install class-transformer
npm install joi
npm install uuid
npm install @types/uuid
```

### 4. Database Setup

#### Initialize DynamoDB Tables (Local Development)
```bash
# Start LocalStack
docker-compose up -d localstack

# Wait for LocalStack to be ready
sleep 30

# Create tables
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name tiktok-users-dev \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
    AttributeName=GSI2PK,AttributeType=S \
    AttributeName=GSI2SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=GSI2,KeySchema=[{AttributeName=GSI2PK,KeyType=HASH},{AttributeName=GSI2SK,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

## 🧪 Testing Instructions

### 1. Start the Application

```bash
# Development mode
cd apps/ingestion-api
npm run start:dev

# Or with Docker
docker-compose up ingestion-api
```

### 2. API Testing

#### Test Handle Validation
```bash
curl -X POST http://localhost:3001/auth/validate-handle \
  -H "Content-Type: application/json" \
  -d '{"handle": "charlidamelio"}'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "exists": true,
    "profilePhotoUrl": "https://...",
    "followerCount": 150000000,
    "isVerified": true,
    "displayName": "charli d'amelio"
  },
  "message": "Handle validation successful",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890_abcdef"
}
```

#### Test Signup Flow
```bash
# Step 1: Initiate signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "testuser123",
    "phoneNumber": "+1234567890"
  }'

# Step 2: Verify signup (use OTP received via SMS)
curl -X POST http://localhost:3001/auth/verify-signup \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "testuser123",
    "phoneNumber": "+1234567890",
    "code": "123456"
  }'
```

#### Test Signin Flow
```bash
# Step 1: Initiate signin
curl -X POST http://localhost:3001/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'

# Step 2: Verify signin
curl -X POST http://localhost:3001/auth/verify-signin \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "code": "123456"
  }'
```

#### Test Protected Routes
```bash
# Get user profile (requires authentication)
curl -X GET http://localhost:3001/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Subscription Testing

#### Test Subscription Guard
```bash
# Access shop link (requires active subscription)
curl -X GET http://localhost:3001/shop/testuser123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected Response (if subscription required):
```json
{
  "success": false,
  "message": "Active subscription required to access this resource",
  "errorCode": "SUBSCRIPTION_REQUIRED",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Configuration Options

### Cognito Custom Auth Flow

The system uses AWS Cognito Lambda triggers for custom authentication:

1. **Define Auth Challenge**: Determines the auth flow
2. **Create Auth Challenge**: Generates SMS OTP
3. **Verify Auth Challenge**: Validates OTP code

### Subscription Levels

```typescript
enum SubscriptionStatus {
  PENDING = 'pending',    // Just signed up, no access
  TRIAL = 'trial',        // Free trial period
  ACTIVE = 'active',      // Paid subscription
  EXPIRED = 'expired',    // Subscription expired
  CANCELLED = 'cancelled' // Subscription cancelled
}
```

### Guard Decorators

```typescript
// Skip authentication
@Public()

// Skip subscription check
@SkipSubscriptionCheck()

// Require specific subscription levels
@RequireActiveSubscription()
@RequireTrialOrActive()
@RequireAnySubscription()
```

## 📊 Monitoring and Logging

### CloudWatch Metrics
- Authentication success/failure rates
- Handle validation performance
- DynamoDB throttling
- Lambda function errors

### Structured Logging
```typescript
// All requests are logged with:
{
  requestId: "req_1234567890_abcdef",
  method: "POST",
  url: "/auth/signup",
  statusCode: 200,
  duration: "150ms",
  userAgent: "...",
  ip: "192.168.1.1"
}
```

## 🚨 Error Handling

### Common Error Codes
- `INVALID_HANDLE`: Handle format is invalid
- `HANDLE_NOT_FOUND`: TikTok handle doesn't exist
- `HANDLE_ALREADY_EXISTS`: Handle already registered
- `PHONE_ALREADY_EXISTS`: Phone number already registered
- `INVALID_CODE`: OTP code is incorrect
- `CODE_EXPIRED`: OTP code has expired
- `SUBSCRIPTION_REQUIRED`: Active subscription needed

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errorCode": "ERROR_CODE",
  "errors": ["Detailed error messages"],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890_abcdef"
}
```

## 🔒 Security Considerations

### JWT Token Security
- Tokens expire after 1 hour
- Refresh tokens valid for 30 days
- Tokens are signed with HS256 algorithm
- Secret key should be at least 32 characters

### Phone Number Validation
- E.164 format required (+1234567890)
- SMS OTP expires after 5 minutes
- Rate limiting prevents abuse

### Handle Validation
- Apify API calls are rate limited
- Fallback to RSS method if Apify fails
- Results are cached to reduce API calls

## 🐛 Troubleshooting

### Common Issues

#### 1. Cognito SMS Not Working
```bash
# Check IAM role permissions
aws iam get-role --role-name tiktok-commerce-cognito-sms-role-dev

# Check SNS permissions
aws sns get-sms-attributes
```

#### 2. DynamoDB Access Issues
```bash
# Check table exists
aws dynamodb describe-table --table-name tiktok-users-dev

# Check IAM permissions
aws sts get-caller-identity
```

#### 3. Apify API Failures
```bash
# Check API key
curl -H "Authorization: Bearer YOUR_APIFY_TOKEN" \
  https://api.apify.com/v2/users/me

# Check actor exists
curl https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run start:dev

# Enable request tracing
ENABLE_TRACING=true npm run start:dev
```

## 📈 Performance Optimization

### Caching Strategy
- Handle validation results cached for 1 hour
- User profile data cached for 15 minutes
- JWT tokens cached until expiration

### Database Optimization
- GSI indexes for efficient lookups
- Batch operations for multiple queries
- Connection pooling for better performance

### Rate Limiting
- 100 requests per 15 minutes per IP
- 10 OTP requests per hour per phone number
- 5 handle validation requests per minute per IP

---

For additional support or questions, please refer to the main documentation or create an issue in the repository.
