# TikTok Commerce Link Hub - Infrastructure Documentation

## Overview

This document provides comprehensive instructions for deploying and managing the AWS infrastructure for the TikTok Commerce Link Hub using Terraform.

## Architecture

The infrastructure consists of:

- **VPC**: 2 AZs with public/private subnets
- **ECS Fargate**: Containerized microservices
- **Application Load Balancer**: HTTP/HTTPS traffic routing
- **DynamoDB**: NoSQL database for application data
- **SNS/SQS**: Event-driven messaging
- **S3**: Object storage for thumbnails
- **Cognito**: User authentication
- **Lambda**: Scheduled ingestion tasks
- **CloudWatch**: Monitoring and alerting

## Prerequisites

### Required Tools

1. **Terraform** (>= 1.0)
   ```bash
   # macOS
   brew install terraform
   
   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

2. **AWS CLI** (>= 2.0)
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

3. **Docker**
   ```bash
   # macOS
   brew install docker
   
   # Linux
   sudo apt-get update
   sudo apt-get install docker.io
   ```

4. **jq** (JSON processor)
   ```bash
   # macOS
   brew install jq
   
   # Linux
   sudo apt-get install jq
   ```

### AWS Configuration

1. **Configure AWS credentials:**
   ```bash
   aws configure
   ```
   
   Or set environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID="your-access-key"
   export AWS_SECRET_ACCESS_KEY="your-secret-key"
   export AWS_DEFAULT_REGION="us-east-1"
   ```

2. **Required AWS permissions:**
   - EC2 (VPC, Subnets, Security Groups)
   - ECS (Clusters, Services, Tasks)
   - ECR (Repositories)
   - Application Load Balancer
   - DynamoDB
   - SNS/SQS
   - S3
   - Cognito
   - Lambda
   - CloudWatch
   - IAM (Roles, Policies)
   - Secrets Manager
   - Systems Manager (Parameter Store)

## Deployment

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tiktok-shop-link-kit
   ```

2. **Set environment variables for secrets:**
   ```bash
   export TF_VAR_apify_token="your_apify_token"
   export TF_VAR_openrouter_api_key="your_openrouter_api_key"
   ```

3. **Deploy infrastructure:**
   ```bash
   # Development
   ./deploy-bootstrap.sh dev
   
   # Staging
   ./deploy-bootstrap.sh staging
   
   # Production
   ./deploy-bootstrap.sh prod
   ```

### Manual Deployment

If you prefer manual deployment:

1. **Navigate to Terraform directory:**
   ```bash
   cd infra/terraform
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init -backend-config="envs/prod/backend.hcl"
   ```

3. **Plan deployment:**
   ```bash
   terraform plan -var-file="envs/prod/terraform.tfvars"
   ```

4. **Apply changes:**
   ```bash
   terraform apply -var-file="envs/prod/terraform.tfvars"
   ```

## Container Management

### Building and Pushing Images

After infrastructure deployment, build and push container images:

1. **Get ECR login:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   ```

2. **Build and push each service:**
   ```bash
   # Ingestion API
   docker build -t buylink-prod-ingestion-api:latest apps/ingestion-api/
   docker tag buylink-prod-ingestion-api:latest <ecr-url>:latest
   docker push <ecr-url>:latest
   
   # Product Service
   docker build -t buylink-prod-product-service:latest apps/product-service/
   docker tag buylink-prod-product-service:latest <ecr-url>:latest
   docker push <ecr-url>:latest
   
   # Thumbnail Generator
   docker build -f apps/ai-workers/thumbnail-generator/Dockerfile.worker -t buylink-prod-thumbnail-generator:latest apps/ai-workers/thumbnail-generator/
   docker tag buylink-prod-thumbnail-generator:latest <ecr-url>:latest
   docker push <ecr-url>:latest
   
   # Caption Parser
   docker build -t buylink-prod-caption-parser:latest apps/ai-workers/caption-parser/
   docker tag buylink-prod-caption-parser:latest <ecr-url>:latest
   docker push <ecr-url>:latest
   
   # Scheduled Ingestion Lambda
   docker build -f apps/ingestion-api/Dockerfile.lambda -t buylink-prod-scheduled-ingestion:latest apps/ingestion-api/
   docker tag buylink-prod-scheduled-ingestion:latest <ecr-url>:latest
   docker push <ecr-url>:latest
   ```

### Updating Services

To update a service with a new image:

1. **Push new image to ECR**
2. **Update ECS service:**
   ```bash
   aws ecs update-service --cluster buylink-prod-cluster --service buylink-prod-ingestion-api --force-new-deployment
   ```

## Secrets Management

### Setting Up Secrets

1. **Apify Token:**
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id buylink-prod/external/apis \
     --secret-string '{"apify_token":"your_token","openrouter_api_key":"your_key"}'
   ```

2. **JWT Secrets (auto-generated):**
   - JWT secrets are automatically generated during deployment
   - Stored in `buylink-prod/auth/jwt`

3. **Admin Credentials:**
   ```bash
   # Generate password hash
   node -e "console.log(require('bcrypt').hashSync('your_password', 10))"
   
   # Update Terraform variable
   export TF_VAR_admin_password_hash="$2b$10$..."
   terraform apply -var-file="envs/prod/terraform.tfvars"
   ```

### Accessing Secrets in Applications

Applications access secrets via environment variables that reference AWS Secrets Manager:

```typescript
// In ECS task definition
"secrets": [
  {
    "name": "APIFY_TOKEN",
    "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:buylink-prod/external/apis:apify_token::"
  }
]
```

## Monitoring and Alerting

### CloudWatch Dashboard

Access the dashboard at:
```
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=buylink-prod-overview
```

### Key Metrics

- **ECS Services**: CPU/Memory utilization
- **SQS Queues**: Message depth and age
- **DynamoDB**: Read/write capacity
- **ALB**: Request count and response times

### Alerts

Alerts are sent to the configured notification email for:
- High CPU/Memory usage
- SQS queue depth
- Application errors
- Budget thresholds

## Scaling

### Auto Scaling

Services automatically scale based on:
- **API Services**: CPU utilization (70% target)
- **AI Workers**: SQS queue depth
- **DynamoDB**: On-demand billing (auto-scales)

### Manual Scaling

To manually adjust service capacity:

```bash
aws ecs update-service \
  --cluster buylink-prod-cluster \
  --service buylink-prod-ingestion-api \
  --desired-count 5
```

## Backup and Recovery

### DynamoDB

- **Point-in-time recovery**: Enabled for all tables
- **Backup retention**: 30 days (production)

### S3

- **Versioning**: Disabled (thumbnails are replaceable)
- **Lifecycle policies**: Automatic transition to cheaper storage classes

### Secrets

- **Recovery window**: 7 days for deleted secrets
- **Cross-region replication**: Optional (disabled by default)

## Cost Optimization

### Current Optimizations

1. **Fargate Spot**: 50% cost reduction for workers
2. **S3 Intelligent Tiering**: Automatic cost optimization
3. **DynamoDB On-Demand**: Pay only for usage
4. **Auto Scaling**: Scale to zero for workers
5. **Log Retention**: 30 days maximum

### Estimated Monthly Costs

| Component | Cost (USD) |
|-----------|------------|
| ECS Fargate | $60 |
| NAT Gateways | $90 |
| ALB | $25 |
| DynamoDB | $10 |
| S3 Storage | $15 |
| Lambda | $1 |
| CloudWatch | $10 |
| **Total** | **~$211** |

### Cost Reduction Tips

1. **Use single NAT Gateway for dev/staging**
2. **Implement VPC endpoints for AWS services**
3. **Use Reserved Instances for predictable workloads**
4. **Set up budget alerts**

## Troubleshooting

### Common Issues

1. **ECS Service Won't Start**
   - Check CloudWatch logs: `/ecs/buylink-prod-service-name`
   - Verify IAM permissions
   - Check security group rules

2. **ALB Health Checks Failing**
   - Verify health check endpoint is responding
   - Check security group allows ALB traffic
   - Review ECS service logs

3. **SQS Messages Not Processing**
   - Check worker service is running
   - Verify IAM permissions for SQS
   - Check dead letter queues

4. **High Costs**
   - Review CloudWatch billing dashboard
   - Check for stuck resources
   - Verify auto-scaling is working

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster buylink-prod-cluster --services buylink-prod-ingestion-api

# View CloudWatch logs
aws logs tail /ecs/buylink-prod-ingestion-api --follow

# Check SQS queue depth
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names ApproximateNumberOfVisibleMessages

# List running tasks
aws ecs list-tasks --cluster buylink-prod-cluster --service-name buylink-prod-ingestion-api
```

## Security

### Network Security

- All compute resources in private subnets
- Security groups with minimal required ports
- NACLs for additional layer of security

### Data Security

- Encryption at rest for all data stores
- Encryption in transit for all communications
- Secrets stored in AWS Secrets Manager
- IAM roles with least privilege

### Access Control

- No hardcoded credentials
- Service-to-service authentication via IAM roles
- Admin access via Cognito with MFA (optional)

## Disaster Recovery

### RTO/RPO Targets

- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective)

### Recovery Procedures

1. **Infrastructure**: Redeploy via Terraform
2. **Data**: Restore from DynamoDB point-in-time recovery
3. **Secrets**: Restore from Secrets Manager
4. **Containers**: Rebuild and deploy from source

## Support

For infrastructure issues:
1. Check CloudWatch logs and metrics
2. Review AWS Health Dashboard
3. Consult this documentation
4. Contact the development team

---

**Last Updated**: 2024-01-09
**Version**: 1.0.0
