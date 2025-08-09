# TikTok Commerce Link Hub - Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the TikTok Commerce Link Hub across different environments using our automated CI/CD pipeline and manual deployment options.

## Deployment Architecture

### **Environments**

1. **Development (`dev`)**
   - Automatic deployment from `develop` branch
   - Cost-optimized configuration
   - Shared resources for testing

2. **Staging (`staging`)**
   - Automatic deployment from `staging` branch
   - Production-like configuration
   - Pre-production testing environment

3. **Production (`prod`)**
   - Automatic deployment from `main` branch
   - High availability configuration
   - Full monitoring and alerting

### **Services**

- **Ingestion API**: TikTok data ingestion and processing
- **Product Service**: Product management and assembly
- **Thumbnail Generator**: AI-powered thumbnail generation
- **Caption Parser**: AI-powered caption analysis
- **Scheduled Ingestion**: Lambda function for periodic ingestion

## Automated Deployment (CI/CD)

### **GitHub Actions Workflows**

#### 1. **Main CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)

**Triggers:**
- Push to `main`, `staging`, or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Pipeline Stages:**
1. **Change Detection**: Determines what services need deployment
2. **Security Scan**: Vulnerability scanning with Trivy
3. **Testing**: Unit tests for Node.js and Python services
4. **Terraform Validation**: Infrastructure validation
5. **Docker Build**: Multi-platform container builds
6. **Infrastructure Deployment**: Terraform apply
7. **Secrets Setup**: AWS Secrets Manager configuration
8. **Service Deployment**: ECS service updates
9. **Health Checks**: Service health validation
10. **Notifications**: Slack/email notifications

**Usage:**
```bash
# Automatic deployment
git push origin main  # Deploys to production
git push origin staging  # Deploys to staging
git push origin develop  # Deploys to development

# Manual deployment
# Go to GitHub Actions → CI/CD Pipeline → Run workflow
# Select environment and options
```

#### 2. **Infrastructure Only** (`.github/workflows/infrastructure-only.yml`)

**Purpose**: Deploy only infrastructure changes without services

**Usage:**
```bash
# Go to GitHub Actions → Infrastructure Only Deployment
# Select environment and action (plan/apply/destroy)
```

#### 3. **Hotfix Deployment** (`.github/workflows/hotfix.yml`)

**Purpose**: Emergency deployments with minimal validation

**Usage:**
```bash
# Go to GitHub Actions → Hotfix Deployment
# Select environment, service, and provide reason
```

### **Required GitHub Secrets**

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_ACCOUNT_ID=123456789012

# External API Keys
APIFY_TOKEN=your_apify_token
OPENROUTER_API_KEY=your_openrouter_key

# Optional: Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Manual Deployment

### **Prerequisites**

1. **Tools Installation:**
   ```bash
   # AWS CLI
   aws configure
   
   # Terraform
   terraform --version  # >= 1.6.0
   
   # Docker
   docker --version
   
   # Node.js
   node --version  # >= 20
   
   # Python
   python --version  # >= 3.11
   ```

2. **Environment Variables:**
   ```bash
   export AWS_REGION=us-east-1
   export APIFY_TOKEN="your_token"
   export OPENROUTER_API_KEY="your_key"
   ```

### **Full Deployment Process**

#### 1. **Deploy Infrastructure**
```bash
# Navigate to project root
cd tiktok-shop-link-kit

# Deploy infrastructure
./deploy-bootstrap.sh prod

# Or step by step:
cd infra/terraform
terraform init -backend-config="envs/prod/backend.hcl"
terraform plan -var-file="envs/prod/terraform.tfvars"
terraform apply -var-file="envs/prod/terraform.tfvars"
```

#### 2. **Setup Secrets**
```bash
# Setup secrets and environment
./scripts/setup-secrets.sh prod
./scripts/configure-environment.sh prod
```

#### 3. **Deploy Services**
```bash
# Deploy all services
./scripts/deploy-services.sh prod

# Deploy specific service
./scripts/deploy-services.sh prod ingestion-api
```

### **Service-Specific Deployment**

#### **Node.js Services** (Ingestion API, Product Service)
```bash
# Build and test locally
cd apps/ingestion-api
npm install
npm run lint
npm run test
npm run build

# Build Docker image
docker build -t ingestion-api:latest .

# Push to ECR (after AWS login)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI
docker tag ingestion-api:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Update ECS service
aws ecs update-service --cluster buylink-prod-cluster --service buylink-prod-ingestion-api --force-new-deployment
```

#### **Python AI Workers** (Thumbnail Generator, Caption Parser)
```bash
# Build and test locally
cd apps/ai-workers/thumbnail-generator
pip install -r requirements.txt
python -m pytest

# Build Docker image
docker build -f Dockerfile.worker -t thumbnail-generator:latest .

# Push and deploy (same as Node.js services)
```

#### **Lambda Functions**
```bash
# Build Lambda image
cd apps/ingestion-api
docker build -f Dockerfile.lambda -t scheduled-ingestion:latest .

# Push to ECR and update Lambda
aws lambda update-function-code --function-name buylink-prod-scheduled-ingestion --image-uri $ECR_URI:latest
```

## Environment Management

### **Environment Promotion**

#### **Development → Staging**
```bash
# Create staging branch from develop
git checkout develop
git pull origin develop
git checkout -b staging
git push origin staging

# Or use GitHub Actions manual deployment
```

#### **Staging → Production**
```bash
# Create pull request from staging to main
# After approval and merge, production deployment is automatic
```

### **Configuration Management**

#### **Environment Variables**
- Managed through Terraform outputs
- Automatically configured by `configure-environment.sh`
- Service-specific `.env` files for local development

#### **Secrets Management**
- AWS Secrets Manager for sensitive data
- Automatic rotation capabilities
- Environment-specific isolation

## Monitoring and Validation

### **Health Checks**

#### **Automated Health Checks**
```bash
# Built into CI/CD pipeline
# Checks service endpoints after deployment
```

#### **Manual Health Checks**
```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --names buylink-prod-alb --query 'LoadBalancers[0].DNSName' --output text)

# Test endpoints
curl http://$ALB_DNS/api/ingestion/health
curl http://$ALB_DNS/api/products/health
```

### **Monitoring**

#### **CloudWatch Dashboards**
- Service metrics and logs
- Infrastructure monitoring
- Cost tracking

#### **Alerts**
- Service health alerts
- Infrastructure alerts
- Budget alerts

## Rollback Procedures

### **Automatic Rollback**
- Built into CI/CD pipeline
- Triggered on health check failures
- Reverts to previous task definition

### **Manual Rollback**

#### **ECS Service Rollback**
```bash
# Get current task definition
CURRENT_TASK_DEF=$(aws ecs describe-services --cluster buylink-prod-cluster --services buylink-prod-ingestion-api --query 'services[0].taskDefinition' --output text)

# Get previous revision
TASK_FAMILY=$(echo $CURRENT_TASK_DEF | cut -d'/' -f2 | cut -d':' -f1)
CURRENT_REVISION=$(echo $CURRENT_TASK_DEF | cut -d':' -f2)
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))

# Rollback to previous revision
aws ecs update-service --cluster buylink-prod-cluster --service buylink-prod-ingestion-api --task-definition $TASK_FAMILY:$PREVIOUS_REVISION
```

#### **Infrastructure Rollback**
```bash
# Revert Terraform changes
cd infra/terraform
git checkout HEAD~1 -- .
terraform plan -var-file="envs/prod/terraform.tfvars"
terraform apply -var-file="envs/prod/terraform.tfvars"
```

## Troubleshooting

### **Common Issues**

#### **Deployment Failures**
1. **Check CloudWatch logs**
2. **Verify IAM permissions**
3. **Check security group rules**
4. **Validate environment variables**

#### **Service Health Check Failures**
1. **Check ECS service status**
2. **Review application logs**
3. **Verify load balancer configuration**
4. **Check target group health**

#### **Infrastructure Issues**
1. **Review Terraform plan**
2. **Check AWS service limits**
3. **Verify backend state**
4. **Check resource dependencies**

### **Debugging Commands**

```bash
# ECS service status
aws ecs describe-services --cluster buylink-prod-cluster --services buylink-prod-ingestion-api

# CloudWatch logs
aws logs tail /ecs/buylink-prod-ingestion-api --follow

# Task definition details
aws ecs describe-task-definition --task-definition buylink-prod-ingestion-api

# Load balancer health
aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN
```

## Security Considerations

### **Access Control**
- GitHub environments with required reviewers
- AWS IAM roles with least privilege
- Secrets stored in AWS Secrets Manager

### **Security Scanning**
- Trivy vulnerability scanning
- Container image scanning
- Infrastructure security validation

### **Compliance**
- Audit logging for all deployments
- Change tracking through Git
- Environment isolation

## Best Practices

### **Development Workflow**
1. **Feature branches** for development
2. **Pull requests** with code review
3. **Automated testing** before merge
4. **Staging validation** before production

### **Deployment Practices**
1. **Blue-green deployments** for zero downtime
2. **Health checks** before traffic routing
3. **Rollback procedures** for quick recovery
4. **Monitoring** for early issue detection

### **Security Practices**
1. **No hardcoded secrets** in code
2. **Regular secret rotation**
3. **Least privilege access**
4. **Security scanning** in pipeline

---

**Last Updated**: 2024-01-09
**Version**: 1.0.0
