# Quick Start: Authentication Production Deployment

This guide provides the fastest path to deploy the authentication feature to AWS production.

## 🚀 Quick Deployment (15 minutes)

### Step 1: AWS Console Setup (5 minutes)

#### 1.1 Configure SMS Settings
```bash
# Go to AWS Console → SNS → Text messaging (SMS)
# Set monthly spending limit to $10.00
aws sns set-sms-attributes --attributes MonthlySpendLimit=10.00

# If in sandbox mode, request production access
# Go to SNS Console → Text messaging (SMS) → Sandbox
```

#### 1.2 Verify AWS CLI Access
```bash
# Test AWS access
aws sts get-caller-identity

# Should return your account ID and user/role
```

### Step 2: Deploy Infrastructure (5 minutes)

#### 2.1 Navigate to Auth Deployment Directory
```bash
cd infra/terraform/auth-minimal
```

#### 2.2 Run Automated Deployment
```bash
# Make script executable
chmod +x deploy.sh

# Deploy to production (default)
./deploy.sh production us-east-1

# Or deploy to staging
./deploy.sh staging us-east-1
```

#### 2.3 Save Deployment Outputs
The script will create `deployment-outputs.env` with:
```bash
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
DYNAMODB_USERS_TABLE=tiktok-commerce-users-production
AWS_REGION=us-east-1
```

### Step 3: Configure Application (5 minutes)

#### 3.1 Update Environment Variables
```bash
# Copy the deployment outputs to your app
cp infra/terraform/auth-minimal/deployment-outputs.env apps/ingestion-api/.env.production

# Add additional required variables
cat >> apps/ingestion-api/.env.production << 'EOF'

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=1h

# Apify Configuration
APIFY_TOKEN=your-apify-token-here
APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper
APIFY_TIMEOUT=60

# Application Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Security
BCRYPT_ROUNDS=12
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
```

#### 3.2 Install Dependencies and Test
```bash
cd apps/ingestion-api

# Install dependencies
npm install

# Test the application
NODE_ENV=production npm run start
```

## 🧪 Quick Testing

### Test 1: Health Check
```bash
curl http://localhost:3001/health
```

### Test 2: Handle Validation
```bash
curl -X POST http://localhost:3001/auth/validate-handle \
  -H "Content-Type: application/json" \
  -d '{"handle": "charlidamelio"}'
```

### Test 3: Signup Flow
```bash
# Step 1: Initiate signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "testuser123",
    "phoneNumber": "+1234567890"
  }'

# Step 2: Verify with OTP (check your phone for SMS)
curl -X POST http://localhost:3001/auth/verify-signup \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "testuser123",
    "phoneNumber": "+1234567890",
    "code": "123456"
  }'
```

## 🔧 Manual AWS Console Steps (Alternative)

If you prefer manual setup instead of the automated script:

### 1. Create DynamoDB Table
```bash
aws dynamodb create-table \
  --table-name tiktok-commerce-users-production \
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
    IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL} \
    IndexName=GSI2,KeySchema=[{AttributeName=GSI2PK,KeyType=HASH},{AttributeName=GSI2SK,KeyType=RANGE}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST
```

### 2. Create Cognito User Pool
```bash
aws cognito-idp create-user-pool \
  --pool-name tiktok-commerce-user-pool-production \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --auto-verified-attributes phone_number \
  --alias-attributes phone_number \
  --mfa-configuration OPTIONAL \
  --schema '[
    {
      "Name": "phone_number",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "tiktok_handle",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    }
  ]'
```

### 3. Create User Pool Client
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name tiktok-commerce-client-production \
  --explicit-auth-flows ALLOW_CUSTOM_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED \
  --access-token-validity 1 \
  --id-token-validity 1 \
  --refresh-token-validity 30 \
  --token-validity-units '{
    "AccessToken": "hours",
    "IdToken": "hours",
    "RefreshToken": "days"
  }'
```

## 🚨 Troubleshooting

### Issue: SMS Not Sending
```bash
# Check SMS configuration
aws sns get-sms-attributes

# Check spending limit
aws sns get-account-attributes

# Verify phone number format (must be E.164)
# Correct: +1234567890
# Incorrect: 1234567890, (123) 456-7890
```

### Issue: DynamoDB Access Denied
```bash
# Check table exists
aws dynamodb describe-table --table-name tiktok-commerce-users-production

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
  --action-names dynamodb:GetItem dynamodb:PutItem \
  --resource-arns arn:aws:dynamodb:us-east-1:$(aws sts get-caller-identity --query Account --output text):table/tiktok-commerce-users-production
```

### Issue: Cognito Errors
```bash
# Check User Pool exists
aws cognito-idp describe-user-pool --user-pool-id YOUR_USER_POOL_ID

# Check User Pool Client
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID
```

### Issue: Lambda Function Errors
```bash
# Check Lambda function logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/tiktok-commerce"

# View recent logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/tiktok-commerce-create-auth-challenge-production" \
  --start-time $(date -d '1 hour ago' +%s)000
```

## 📊 Production Checklist

### Before Deployment
- [ ] AWS CLI configured with production credentials
- [ ] SMS spending limit set appropriately
- [ ] Domain name and SSL certificates ready (if using custom domain)
- [ ] Apify account and token obtained
- [ ] JWT secret generated (32+ characters)

### After Deployment
- [ ] All Terraform resources created successfully
- [ ] DynamoDB table accessible
- [ ] Cognito User Pool configured
- [ ] Lambda functions deployed and working
- [ ] SMS OTP delivery working
- [ ] API endpoints responding correctly
- [ ] Environment variables configured
- [ ] Application starts without errors

### Security Verification
- [ ] HTTPS enforced for all API calls
- [ ] Rate limiting configured
- [ ] Input validation working
- [ ] Error messages don't leak sensitive information
- [ ] JWT tokens have appropriate expiration
- [ ] Phone number validation working

## 🎯 Next Steps

After successful deployment:

1. **Set up monitoring**: Configure CloudWatch alarms and dashboards
2. **Configure CI/CD**: Set up automated deployments
3. **Load testing**: Test with realistic user loads
4. **Backup strategy**: Implement regular backups
5. **Documentation**: Update team documentation with production details

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Verify all environment variables are set correctly
4. Ensure AWS permissions are properly configured

The authentication system is now ready for production use! 🎉
