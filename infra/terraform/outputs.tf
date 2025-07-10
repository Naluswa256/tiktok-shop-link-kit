# S3 Outputs
output "s3_assets_bucket_name" {
  description = "Name of the S3 assets bucket"
  value       = module.s3_assets.bucket_name
}

output "s3_assets_bucket_arn" {
  description = "ARN of the S3 assets bucket"
  value       = module.s3_assets.bucket_arn
}

output "s3_thumbnails_bucket_name" {
  description = "Name of the S3 thumbnails bucket"
  value       = module.s3_thumbnails.bucket_name
}

output "s3_thumbnails_bucket_arn" {
  description = "ARN of the S3 thumbnails bucket"
  value       = module.s3_thumbnails.bucket_arn
}

# DynamoDB Outputs
output "dynamodb_videos_table_name" {
  description = "Name of the DynamoDB videos table"
  value       = module.dynamodb_videos.table_name
}

output "dynamodb_videos_table_arn" {
  description = "ARN of the DynamoDB videos table"
  value       = module.dynamodb_videos.table_arn
}

output "dynamodb_products_table_name" {
  description = "Name of the DynamoDB products table"
  value       = module.dynamodb_products.table_name
}

output "dynamodb_products_table_arn" {
  description = "ARN of the DynamoDB products table"
  value       = module.dynamodb_products.table_arn
}

output "dynamodb_jobs_table_name" {
  description = "Name of the DynamoDB processing jobs table"
  value       = module.dynamodb_jobs.table_name
}

output "dynamodb_jobs_table_arn" {
  description = "ARN of the DynamoDB processing jobs table"
  value       = module.dynamodb_jobs.table_arn
}

# SNS Outputs
output "sns_processing_topic_arn" {
  description = "ARN of the SNS processing topic"
  value       = module.sns_processing.topic_arn
}

# SQS Outputs
output "sqs_caption_analysis_queue_url" {
  description = "URL of the caption analysis SQS queue"
  value       = module.sqs_caption_analysis.queue_url
}

output "sqs_caption_analysis_queue_arn" {
  description = "ARN of the caption analysis SQS queue"
  value       = module.sqs_caption_analysis.queue_arn
}

output "sqs_thumbnail_generation_queue_url" {
  description = "URL of the thumbnail generation SQS queue"
  value       = module.sqs_thumbnail_generation.queue_url
}

output "sqs_thumbnail_generation_queue_arn" {
  description = "ARN of the thumbnail generation SQS queue"
  value       = module.sqs_thumbnail_generation.queue_arn
}

output "sqs_auto_tagging_queue_url" {
  description = "URL of the auto tagging SQS queue"
  value       = module.sqs_auto_tagging.queue_url
}

output "sqs_auto_tagging_queue_arn" {
  description = "ARN of the auto tagging SQS queue"
  value       = module.sqs_auto_tagging.queue_arn
}

# Lambda Outputs
output "lambda_caption_parser_function_name" {
  description = "Name of the caption parser Lambda function"
  value       = module.lambda_caption_parser.function_name
}

output "lambda_caption_parser_function_arn" {
  description = "ARN of the caption parser Lambda function"
  value       = module.lambda_caption_parser.function_arn
}

output "lambda_thumbnail_generator_function_name" {
  description = "Name of the thumbnail generator Lambda function"
  value       = module.lambda_thumbnail_generator.function_name
}

output "lambda_thumbnail_generator_function_arn" {
  description = "ARN of the thumbnail generator Lambda function"
  value       = module.lambda_thumbnail_generator.function_arn
}

output "lambda_auto_tagger_function_name" {
  description = "Name of the auto tagger Lambda function"
  value       = module.lambda_auto_tagger.function_name
}

output "lambda_auto_tagger_function_arn" {
  description = "ARN of the auto tagger Lambda function"
  value       = module.lambda_auto_tagger.function_arn
}

# ECS Service Outputs
output "ingestion_api_service_name" {
  description = "Name of the ingestion API ECS service"
  value       = module.ingestion_api.service_name
}

output "ingestion_api_service_arn" {
  description = "ARN of the ingestion API ECS service"
  value       = module.ingestion_api.service_arn
}

output "product_service_service_name" {
  description = "Name of the product service ECS service"
  value       = module.product_service.service_name
}

output "product_service_service_arn" {
  description = "ARN of the product service ECS service"
  value       = module.product_service.service_arn
}

# API Gateway Outputs (if implemented)
output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = try(module.api_gateway.api_url, "")
}

output "api_gateway_stage" {
  description = "Stage of the API Gateway"
  value       = try(module.api_gateway.stage_name, "")
}

# CloudFront Outputs (if implemented)
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = try(module.cloudfront.distribution_id, "")
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = try(module.cloudfront.domain_name, "")
}

# VPC Outputs (if implemented)
output "vpc_id" {
  description = "ID of the VPC"
  value       = try(module.vpc.vpc_id, "")
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = try(module.vpc.public_subnet_ids, [])
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = try(module.vpc.private_subnet_ids, [])
}

# Security Group Outputs (if implemented)
output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = try(module.security_groups.ecs_security_group_id, "")
}

output "lambda_security_group_id" {
  description = "ID of the Lambda security group"
  value       = try(module.security_groups.lambda_security_group_id, "")
}

# IAM Role Outputs
output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = try(module.iam_roles.ecs_task_role_arn, "")
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = try(module.iam_roles.lambda_execution_role_arn, "")
}

# Monitoring Outputs
output "cloudwatch_log_group_names" {
  description = "Names of CloudWatch log groups"
  value = {
    ingestion_api        = try(module.ingestion_api.log_group_name, "")
    product_service      = try(module.product_service.log_group_name, "")
    caption_parser       = try(module.lambda_caption_parser.log_group_name, "")
    thumbnail_generator  = try(module.lambda_thumbnail_generator.log_group_name, "")
    auto_tagger         = try(module.lambda_auto_tagger.log_group_name, "")
  }
}

# Environment Configuration
output "environment_variables" {
  description = "Environment variables for applications"
  value = {
    # Database
    DYNAMODB_VIDEOS_TABLE   = module.dynamodb_videos.table_name
    DYNAMODB_PRODUCTS_TABLE = module.dynamodb_products.table_name
    DYNAMODB_JOBS_TABLE     = module.dynamodb_jobs.table_name
    
    # Storage
    S3_ASSETS_BUCKET     = module.s3_assets.bucket_name
    S3_THUMBNAILS_BUCKET = module.s3_thumbnails.bucket_name
    
    # Messaging
    SNS_PROCESSING_TOPIC_ARN           = module.sns_processing.topic_arn
    SQS_CAPTION_ANALYSIS_QUEUE_URL     = module.sqs_caption_analysis.queue_url
    SQS_THUMBNAIL_GENERATION_QUEUE_URL = module.sqs_thumbnail_generation.queue_url
    SQS_AUTO_TAGGING_QUEUE_URL         = module.sqs_auto_tagging.queue_url
    
    # AWS
    AWS_REGION = var.aws_region
  }
  sensitive = false
}

# Cost Estimation
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    dynamodb = "~$5-20 (depending on usage)"
    lambda   = "~$10-50 (depending on invocations)"
    ecs      = "~$30-100 (depending on instance types)"
    s3       = "~$5-25 (depending on storage and requests)"
    data_transfer = "~$5-20 (depending on traffic)"
    total_estimate = "~$55-215 per month"
  }
}
