# TikTok Commerce Authentication Infrastructure

This directory contains the minimal Terraform configuration for deploying only the authentication-related infrastructure for the TikTok Commerce Link Hub.

## 🏗️ Infrastructure Components

### AWS Cognito
- **User Pool**: For user management and authentication
- **User Pool Client**: Public client for username/password authentication
- **Authentication Flows**: USER_PASSWORD_AUTH and REFRESH_TOKEN_AUTH

### DynamoDB
- **Users Table**: Stores user data with GSI indexes for efficient lookups
- **Billing Mode**: Pay-per-request (free tier friendly)
- **Encryption**: Server-side encryption enabled
- **TTL**: Automatic cleanup of expired data

### Security
- **KMS Key**: For DynamoDB encryption (production only)
- **IAM Policies**: Minimal required permissions
- **No MFA**: Simplified authentication for development

## 📋 Prerequisites

### 1. AWS Account Setup
- AWS Account with appropriate permissions
- IAM user with programmatic access
- Required IAM permissions (see below)

### 2. Required Tools
- Terraform >= 1.0
- AWS CLI configured
- Bash shell (for deployment scripts)

### 3. IAM Permissions Required
Your AWS user needs these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*",
        "dynamodb:*",
        "kms:*",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🚀 Quick Start

### 1. Configure AWS Credentials
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, and region (us-east-1)
```

### 2. Update Configuration
Edit `terraform.tfvars` with your settings:
```hcl
project_name = "tiktok-commerce"
environment = "dev"
aws_region = "us-east-1"
apify_token = "your-apify-token-here"
```

### 3. Deploy Infrastructure
```bash
# Deploy to development environment
./deploy.sh dev

# Deploy to production environment
./deploy.sh production
```

### 4. Get Outputs
After deployment, the script will show you the configuration values needed for your authentication service.

## 📁 File Structure

```
auth-minimal/
├── main.tf              # Main Terraform configuration
├── variables.tf         # Input variables
├── outputs.tf          # Output values
├── terraform.tfvars    # Variable values
├── deploy.sh           # Deployment script
├── destroy.sh          # Cleanup script
└── README.md           # This file
```

## 🔧 Configuration

### Environment Variables
The deployment outputs these environment variables for your auth service:

```bash
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_REGION=us-east-1
DYNAMODB_USERS_TABLE=tiktok-commerce-users-dev
APIFY_ACTOR_ID=clockworks/tiktok-profile-scraper
NODE_ENV=dev
```

### Terraform Variables
Key variables you can customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Project name prefix | `tiktok-commerce` |
| `environment` | Environment (dev/staging/production) | `dev` |
| `aws_region` | AWS region | `us-east-1` |
| `apify_token` | Apify API token | `""` |
| `enable_point_in_time_recovery` | Enable DynamoDB PITR | `false` |
| `log_retention_days` | CloudWatch log retention | `7` |

## 🗑️ Cleanup

To destroy all resources:
```bash
./destroy.sh dev
```

**⚠️ WARNING**: This permanently deletes all user data and cannot be undone!

## 🔍 Troubleshooting

### Common Issues

1. **AWS Credentials Error**
   ```bash
   aws sts get-caller-identity
   ```
   If this fails, reconfigure your AWS credentials.

2. **Terraform Init Fails**
   - Check if you have the correct AWS region configured
   - Ensure your IAM user has the required permissions

3. **Resource Already Exists**
   - Check if resources were created in a previous deployment
   - Use `terraform import` to import existing resources

### Debug Mode
Enable debug logging:
```bash
export TF_LOG=DEBUG
./deploy.sh dev
```

## 📊 Cost Estimation

### Free Tier Usage
- **Cognito**: 50,000 MAUs free
- **DynamoDB**: 25 GB storage, 25 RCU/WCU free
- **KMS**: 20,000 requests free per month

### Estimated Monthly Cost (beyond free tier)
- **Development**: ~$0-5/month
- **Production**: ~$10-50/month (depending on usage)

## 🔐 Security Considerations

### Development Environment
- No MFA enabled (for simplicity)
- Public client (no client secret)
- Minimal encryption

### Production Environment
- Point-in-time recovery enabled
- KMS encryption enabled
- Deletion protection enabled
- Consider enabling MFA

## 📚 Next Steps

After deployment:
1. Update your authentication service with the output values
2. Test the authentication flows
3. Configure your frontend to use the Cognito client
4. Set up monitoring and alerting
5. Plan for production deployment

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Terraform logs
3. Verify AWS permissions
4. Check AWS service limits
