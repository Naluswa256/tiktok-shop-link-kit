# Development vs Production Environment Comparison

This document provides a comprehensive comparison between local development and AWS production environments, including setup procedures, operational differences, and migration strategies.

## 📋 Table of Contents

- [Environment Overview](#environment-overview)
- [Infrastructure Comparison](#infrastructure-comparison)
- [Service Configuration](#service-configuration)
- [Data Management](#data-management)
- [Security Differences](#security-differences)
- [Performance Characteristics](#performance-characteristics)
- [Operational Procedures](#operational-procedures)
- [Migration Strategies](#migration-strategies)

## 🌍 Environment Overview

### Development Environment
- **Purpose**: Local development, testing, and debugging
- **Infrastructure**: Docker Compose + LocalStack
- **Cost**: Free (local resources only)
- **Scalability**: Single machine limitations
- **Availability**: Developer-dependent

### Production Environment
- **Purpose**: Live application serving real users
- **Infrastructure**: AWS managed services
- **Cost**: Pay-per-use AWS pricing
- **Scalability**: Auto-scaling, multi-AZ
- **Availability**: 99.99% SLA target

## 🏗️ Infrastructure Comparison

### Compute Services

| Component | Development | Production |
|-----------|-------------|------------|
| **Frontend** | Vite Dev Server (localhost:8080) | S3 + CloudFront CDN |
| **APIs** | Docker containers | ECS Fargate with ALB |
| **AI Workers** | Docker containers | AWS Lambda functions |
| **Load Balancer** | Nginx (optional) | Application Load Balancer |
| **Auto Scaling** | Manual scaling | Auto Scaling Groups |

#### Development Setup
```yaml
# docker-compose.yml
services:
  frontend:
    build: ./apps/frontend/Dockerfile.dev
    ports: ["8080:8080"]
    volumes: ["./apps/frontend:/app"]
    
  ingestion-api:
    build: ./apps/ingestion-api/Dockerfile.dev
    ports: ["3001:3001"]
    environment:
      - NODE_ENV=development
```

#### Production Setup
```hcl
# Terraform configuration
resource "aws_ecs_service" "ingestion_api" {
  name            = "ingestion-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ingestion_api.arn
  desired_count   = 2
  
  load_balancer {
    target_group_arn = aws_lb_target_group.ingestion_api.arn
    container_name   = "ingestion-api"
    container_port   = 3001
  }
}
```

### Data Services

| Service | Development | Production |
|---------|-------------|------------|
| **Database** | LocalStack DynamoDB | AWS DynamoDB |
| **Storage** | LocalStack S3 | AWS S3 with versioning |
| **Cache** | Redis container | ElastiCache Redis cluster |
| **Messaging** | LocalStack SNS/SQS | AWS SNS/SQS with DLQ |
| **Backup** | Manual exports | Automated backups |

#### Development Data Access
```bash
# DynamoDB
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# S3
aws --endpoint-url=http://localhost:4566 s3 ls s3://bucket-name

# Redis
docker-compose exec redis redis-cli
```

#### Production Data Access
```bash
# DynamoDB
aws dynamodb list-tables --region us-east-1

# S3
aws s3 ls s3://production-bucket-name

# Redis
redis-cli -h production-cluster.cache.amazonaws.com
```

### Networking

| Aspect | Development | Production |
|--------|-------------|------------|
| **Network** | Docker bridge network | VPC with public/private subnets |
| **DNS** | localhost/container names | Route 53 with custom domain |
| **SSL/TLS** | HTTP (development only) | HTTPS with ACM certificates |
| **Firewall** | Docker network isolation | Security Groups + NACLs |
| **CDN** | None | CloudFront global distribution |

## ⚙️ Service Configuration

### Environment Variables

#### Development Configuration
```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
PORT=3001

# LocalStack endpoints
DYNAMODB_ENDPOINT=http://localstack:4566
S3_ENDPOINT=http://localstack:4566
SNS_ENDPOINT=http://localstack:4566
SQS_ENDPOINT=http://localstack:4566

# Local Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Mock credentials
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
```

#### Production Configuration
```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=info
PORT=3001

# AWS services (no endpoints needed)
AWS_REGION=us-east-1

# Production Redis
REDIS_HOST=prod-cluster.abc123.cache.amazonaws.com
REDIS_PORT=6379

# Real credentials (from IAM roles)
# AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY not needed with IAM roles
```

### Service Discovery

#### Development
```yaml
# Services communicate via container names
environment:
  - PRODUCT_SERVICE_URL=http://product-service:3002
  - INGESTION_SERVICE_URL=http://ingestion-api:3001
```

#### Production
```hcl
# Services communicate via load balancer DNS
resource "aws_lb" "main" {
  name               = "tiktok-commerce-alb"
  load_balancer_type = "application"
  subnets           = aws_subnet.public[*].id
}

# Service discovery via Route 53
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.tiktokcommerce.com"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
```

## 💾 Data Management

### Database Operations

#### Development Database
```bash
# Initialize tables
./localstack-init/init.sh

# Seed test data
npm run seed:dev

# Reset database
docker-compose down -v
docker-compose up -d localstack
./localstack-init/init.sh
```

#### Production Database
```bash
# Deploy via Terraform
terraform apply -var-file=production.tfvars

# Backup database
aws dynamodb create-backup \
  --table-name tiktok-commerce-products-prod \
  --backup-name daily-backup-$(date +%Y%m%d)

# Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name restored-table \
  --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/products/backup/01234567890123-abcdefgh
```

### File Storage

#### Development Storage
```bash
# Upload file to LocalStack S3
aws --endpoint-url=http://localhost:4566 s3 cp \
  local-file.jpg s3://tiktok-commerce-assets-dev/

# List files
aws --endpoint-url=http://localhost:4566 s3 ls \
  s3://tiktok-commerce-assets-dev/
```

#### Production Storage
```bash
# Upload file to AWS S3
aws s3 cp local-file.jpg s3://tiktok-commerce-assets-prod/

# Set up lifecycle policies
aws s3api put-bucket-lifecycle-configuration \
  --bucket tiktok-commerce-assets-prod \
  --lifecycle-configuration file://lifecycle.json
```

### Cache Management

#### Development Cache
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Monitor cache
redis-cli monitor

# Clear cache
redis-cli flushall
```

#### Production Cache
```bash
# Connect to ElastiCache
redis-cli -h prod-cluster.abc123.cache.amazonaws.com

# Monitor via CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHits \
  --dimensions Name=CacheClusterId,Value=prod-cluster-001
```

## 🔒 Security Differences

### Authentication & Authorization

#### Development Security
- **API Keys**: Stored in `.env` files
- **Authentication**: Simplified or mocked
- **HTTPS**: Not required (HTTP acceptable)
- **Secrets**: Plain text in environment variables

#### Production Security
- **API Keys**: AWS Secrets Manager
- **Authentication**: Full OAuth/JWT implementation
- **HTTPS**: Required with valid certificates
- **Secrets**: Encrypted at rest and in transit

```hcl
# Production secrets management
resource "aws_secretsmanager_secret" "api_keys" {
  name = "tiktok-commerce/api-keys"
  
  replica {
    region = "us-west-2"
  }
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    openai_api_key = var.openai_api_key
    whatsapp_token = var.whatsapp_access_token
  })
}
```

### Network Security

#### Development Network
```yaml
# Docker network isolation
networks:
  tiktok-network:
    driver: bridge
```

#### Production Network
```hcl
# VPC with security groups
resource "aws_security_group" "ecs" {
  name_prefix = "tiktok-commerce-ecs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3001
    to_port         = 3003
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
}
```

## 📊 Performance Characteristics

### Resource Allocation

| Resource | Development | Production |
|----------|-------------|------------|
| **CPU** | Shared host CPU | Dedicated vCPUs |
| **Memory** | Limited by host RAM | Guaranteed allocation |
| **Storage** | Host filesystem | EBS volumes with IOPS |
| **Network** | Host network | Dedicated bandwidth |

### Scaling Behavior

#### Development Scaling
```bash
# Manual scaling
docker-compose up --scale ingestion-api=3

# Resource monitoring
docker stats
```

#### Production Scaling
```hcl
# Auto scaling configuration
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.ingestion_api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "scale_up" {
  name               = "scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

## 🔧 Operational Procedures

### Deployment Process

#### Development Deployment
```bash
# Start services
npm run docker:up

# Update single service
docker-compose up -d --no-deps ingestion-api

# View logs
docker-compose logs -f ingestion-api
```

#### Production Deployment
```bash
# Build and push images
npm run docker:build:prod
npm run docker:push

# Deploy infrastructure
terraform plan -var-file=production.tfvars
terraform apply

# Deploy services
aws ecs update-service \
  --cluster production-cluster \
  --service ingestion-api \
  --force-new-deployment
```

### Monitoring & Logging

#### Development Monitoring
```bash
# View container logs
docker-compose logs --tail=100 -f

# Monitor resources
docker stats

# Health checks
curl http://localhost:3001/health
```

#### Production Monitoring
```bash
# CloudWatch logs
aws logs tail /ecs/tiktok-commerce-ingestion-api --follow

# Metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization

# Alarms
aws cloudwatch describe-alarms \
  --alarm-names tiktok-commerce-high-cpu
```

### Backup & Recovery

#### Development Backup
```bash
# Export DynamoDB data
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name tiktok-videos-dev > backup.json

# Backup volumes
docker run --rm -v tiktok-shop-link-kit_localstack-data:/data \
  -v $(pwd):/backup alpine tar czf /backup/localstack-backup.tar.gz /data
```

#### Production Backup
```bash
# Automated DynamoDB backups
aws dynamodb put-backup-policy \
  --table-name tiktok-commerce-products-prod \
  --backup-policy BackupEnabled=true

# S3 versioning and lifecycle
aws s3api put-bucket-versioning \
  --bucket tiktok-commerce-assets-prod \
  --versioning-configuration Status=Enabled
```

## 🔄 Migration Strategies

### Development to Staging
```bash
# 1. Export development data
npm run export:dev-data

# 2. Deploy to staging
terraform workspace select staging
terraform apply -var-file=staging.tfvars

# 3. Import data to staging
npm run import:staging-data

# 4. Run smoke tests
npm run test:staging
```

### Staging to Production
```bash
# 1. Final testing
npm run test:e2e:staging

# 2. Create production deployment
terraform workspace select production
terraform plan -var-file=production.tfvars

# 3. Blue-green deployment
aws ecs create-service --service-name ingestion-api-green
aws elbv2 modify-target-group --target-group-arn $GREEN_TG

# 4. Health checks and rollback capability
aws ecs describe-services --services ingestion-api-green
```

### Data Migration
```bash
# DynamoDB migration
aws dynamodb create-backup --table-name source-table
aws dynamodb restore-table-from-backup \
  --target-table-name target-table \
  --backup-arn $BACKUP_ARN

# S3 migration
aws s3 sync s3://source-bucket s3://target-bucket \
  --storage-class STANDARD_IA
```

---

**Next**: [Operational Runbooks](../operations/runbooks.md)
