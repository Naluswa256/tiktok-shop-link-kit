# TikTok Commerce Link Hub - Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

# ECS Outputs
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = module.ecs_cluster.cluster_id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs_cluster.cluster_arn
}

# ECR Outputs
output "ecr_repository_urls" {
  description = "URLs of ECR repositories"
  value       = module.ecr_repos.repository_urls
}

output "ecr_repository_arns" {
  description = "ARNs of ECR repositories"
  value       = module.ecr_repos.repository_arns
}

# ALB Outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.alb.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.alb.arn
}

# DynamoDB Outputs
output "dynamodb_table_names" {
  description = "Names of DynamoDB tables"
  value       = module.dynamodb_tables.table_names
}

output "dynamodb_table_arns" {
  description = "ARNs of DynamoDB tables"
  value       = module.dynamodb_tables.table_arns
}

# SNS Outputs
output "sns_topic_arns" {
  description = "ARNs of SNS topics"
  value       = module.sns_topics.topic_arns
}

# SQS Outputs
output "sqs_queue_urls" {
  description = "URLs of SQS queues"
  value       = module.sqs_queues.queue_urls
}

output "sqs_queue_arns" {
  description = "ARNs of SQS queues"
  value       = module.sqs_queues.queue_arns
}

output "sqs_dlq_urls" {
  description = "URLs of SQS dead letter queues"
  value       = module.sqs_queues.dlq_urls
}

# S3 Outputs
output "s3_bucket_names" {
  description = "Names of S3 buckets"
  value       = module.s3_buckets.bucket_names
}

output "s3_bucket_arns" {
  description = "ARNs of S3 buckets"
  value       = module.s3_buckets.bucket_arns
}

output "s3_bucket_domain_names" {
  description = "Domain names of S3 buckets"
  value       = module.s3_buckets.bucket_domain_names
}

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = module.cognito.user_pool_arn
}

output "cognito_user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = module.cognito.user_pool_client_id
  sensitive   = true
}

output "cognito_user_pool_domain" {
  description = "Domain of the Cognito User Pool"
  value       = module.cognito.user_pool_domain
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

# Service Endpoints (for application configuration)
output "service_endpoints" {
  description = "Service endpoints for application configuration"
  value = {
    alb_dns_name = module.alb.dns_name
    api_base_url = var.enable_https ? "https://${module.alb.dns_name}" : "http://${module.alb.dns_name}"
  }
}

# Environment Variables for Applications
output "application_config" {
  description = "Configuration values for applications"
  value = {
    # DynamoDB Tables
    DYNAMODB_USERS_TABLE          = module.dynamodb_tables.table_names["users"]
    DYNAMODB_SHOPS_TABLE          = module.dynamodb_tables.table_names["shops"]
    DYNAMODB_PRODUCTS_TABLE       = module.dynamodb_tables.table_names["products"]
    DYNAMODB_ADMIN_SESSIONS_TABLE = module.dynamodb_tables.table_names["admin_sessions"]
    DYNAMODB_INGESTION_STATE_TABLE = module.dynamodb_tables.table_names["ingestion_state"]
    
    # SNS Topics
    SNS_NEW_VIDEO_POSTED_TOPIC_ARN = module.sns_topics.topic_arns["new_video_posted"]
    
    # SQS Queues
    SQS_THUMBNAIL_GENERATION_QUEUE_URL = module.sqs_queues.queue_urls["thumbnail_generation"]
    SQS_CAPTION_PARSING_QUEUE_URL      = module.sqs_queues.queue_urls["caption_parsing"]
    SQS_PRODUCT_ASSEMBLY_QUEUE_URL     = module.sqs_queues.queue_urls["product_assembly"]
    
    # S3 Buckets
    S3_THUMBNAILS_BUCKET_NAME = module.s3_buckets.bucket_names["thumbnails"]
    S3_LOGS_BUCKET_NAME       = module.s3_buckets.bucket_names["logs"]
    
    # Cognito
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.user_pool_client_id
    
    # General
    AWS_REGION   = var.aws_region
    ENVIRONMENT  = var.environment
    PROJECT_NAME = var.project_name
  }
  sensitive = true
}

# Docker Build Commands
output "docker_build_commands" {
  description = "Docker build and push commands for each service"
  value = {
    ingestion_api = {
      build = "docker build -t ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-ingestion-api"]}:latest apps/ingestion-api/"
      push  = "docker push ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-ingestion-api"]}:latest"
    }
    product_service = {
      build = "docker build -t ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-product-service"]}:latest apps/product-service/"
      push  = "docker push ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-product-service"]}:latest"
    }
    thumbnail_generator = {
      build = "docker build -f apps/ai-workers/thumbnail-generator/Dockerfile.worker -t ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-thumbnail-generator"]}:latest apps/ai-workers/thumbnail-generator/"
      push  = "docker push ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-thumbnail-generator"]}:latest"
    }
    caption_parser = {
      build = "docker build -t ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-caption-parser"]}:latest apps/ai-workers/caption-parser/"
      push  = "docker push ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-caption-parser"]}:latest"
    }
    scheduled_ingestion = {
      build = "docker build -f apps/ingestion-api/Dockerfile.lambda -t ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-scheduled-ingestion"]}:latest apps/ingestion-api/"
      push  = "docker push ${module.ecr_repos.repository_urls["${var.project_name}-${var.environment}-scheduled-ingestion"]}:latest"
    }
  }
}
