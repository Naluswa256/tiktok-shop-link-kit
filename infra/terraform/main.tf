terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure this in terraform init or backend config file
    # bucket = "your-terraform-state-bucket"
    # key    = "tiktok-commerce/terraform.tfstate"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TikTok Commerce Link Hub"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  common_tags = {
    Project     = "TikTok Commerce Link Hub"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Resource naming convention
  name_prefix = "${var.project_name}-${var.environment}"
}

# S3 Buckets
module "s3_assets" {
  source = "./modules/s3_bucket"
  
  bucket_name = "${local.name_prefix}-assets"
  environment = var.environment
  
  versioning_enabled = true
  public_read_access = true
  cors_enabled      = true
  
  cors_allowed_origins = var.cors_origins
  
  tags = local.common_tags
}

module "s3_thumbnails" {
  source = "./modules/s3_bucket"
  
  bucket_name = "${local.name_prefix}-thumbnails"
  environment = var.environment
  
  versioning_enabled = false
  public_read_access = true
  cors_enabled      = true
  
  cors_allowed_origins = var.cors_origins
  
  tags = local.common_tags
}

# DynamoDB Tables
module "dynamodb_videos" {
  source = "./modules/dynamodb"
  
  table_name = "${local.name_prefix}-videos"
  hash_key   = "id"
  
  attributes = [
    {
      name = "id"
      type = "S"
    },
    {
      name = "userId"
      type = "S"
    },
    {
      name = "createdAt"
      type = "S"
    }
  ]
  
  global_secondary_indexes = [
    {
      name     = "UserIndex"
      hash_key = "userId"
      range_key = "createdAt"
      projection_type = "ALL"
    }
  ]
  
  tags = local.common_tags
}

module "dynamodb_products" {
  source = "./modules/dynamodb"
  
  table_name = "${local.name_prefix}-products"
  hash_key   = "id"
  
  attributes = [
    {
      name = "id"
      type = "S"
    },
    {
      name = "category"
      type = "S"
    },
    {
      name = "createdAt"
      type = "S"
    }
  ]
  
  global_secondary_indexes = [
    {
      name     = "CategoryIndex"
      hash_key = "category"
      range_key = "createdAt"
      projection_type = "ALL"
    }
  ]
  
  tags = local.common_tags
}

module "dynamodb_jobs" {
  source = "./modules/dynamodb"
  
  table_name = "${local.name_prefix}-processing-jobs"
  hash_key   = "id"
  
  attributes = [
    {
      name = "id"
      type = "S"
    },
    {
      name = "videoId"
      type = "S"
    },
    {
      name = "status"
      type = "S"
    },
    {
      name = "createdAt"
      type = "S"
    }
  ]
  
  global_secondary_indexes = [
    {
      name     = "VideoIndex"
      hash_key = "videoId"
      range_key = "createdAt"
      projection_type = "ALL"
    },
    {
      name     = "StatusIndex"
      hash_key = "status"
      range_key = "createdAt"
      projection_type = "ALL"
    }
  ]
  
  tags = local.common_tags
}

# SNS Topics
module "sns_processing" {
  source = "./modules/sns_topic"
  
  topic_name = "${local.name_prefix}-processing"
  
  tags = local.common_tags
}

# SQS Queues
module "sqs_caption_analysis" {
  source = "./modules/sqs_queue"
  
  queue_name = "${local.name_prefix}-caption-analysis"
  
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600 # 14 days
  
  dead_letter_queue_enabled = true
  max_receive_count        = 3
  
  tags = local.common_tags
}

module "sqs_thumbnail_generation" {
  source = "./modules/sqs_queue"
  
  queue_name = "${local.name_prefix}-thumbnail-generation"
  
  visibility_timeout_seconds = 600
  message_retention_seconds  = 1209600 # 14 days
  
  dead_letter_queue_enabled = true
  max_receive_count        = 3
  
  tags = local.common_tags
}

module "sqs_auto_tagging" {
  source = "./modules/sqs_queue"
  
  queue_name = "${local.name_prefix}-auto-tagging"
  
  visibility_timeout_seconds = 180
  message_retention_seconds  = 1209600 # 14 days
  
  dead_letter_queue_enabled = true
  max_receive_count        = 3
  
  tags = local.common_tags
}

# AI Workers (Lambda Functions)
module "lambda_caption_parser" {
  source = "./modules/ai_worker"
  
  function_name = "${local.name_prefix}-caption-parser"
  description   = "AI worker for parsing TikTok video captions"
  
  source_dir = "../../apps/ai-workers/caption-parser"
  handler    = "main.lambda_handler"
  runtime    = "python3.11"
  timeout    = 300
  memory_size = 1024
  
  environment_variables = {
    SNS_TOPIC_ARN = module.sns_processing.topic_arn
    S3_BUCKET     = module.s3_assets.bucket_name
    OPENAI_API_KEY = var.openai_api_key
  }
  
  event_source_arn = module.sqs_caption_analysis.queue_arn
  
  tags = local.common_tags
}

module "lambda_thumbnail_generator" {
  source = "./modules/ai_worker"
  
  function_name = "${local.name_prefix}-thumbnail-generator"
  description   = "AI worker for generating product thumbnails"
  
  source_dir = "../../apps/ai-workers/thumbnail-generator"
  handler    = "main.lambda_handler"
  runtime    = "python3.11"
  timeout    = 600
  memory_size = 2048
  
  environment_variables = {
    SNS_TOPIC_ARN = module.sns_processing.topic_arn
    S3_BUCKET     = module.s3_thumbnails.bucket_name
  }
  
  event_source_arn = module.sqs_thumbnail_generation.queue_arn
  
  tags = local.common_tags
}

module "lambda_auto_tagger" {
  source = "./modules/ai_worker"
  
  function_name = "${local.name_prefix}-auto-tagger"
  description   = "AI worker for auto-tagging content"
  
  source_dir = "../../apps/ai-workers/auto-tagger"
  handler    = "main.lambda_handler"
  runtime    = "python3.11"
  timeout    = 180
  memory_size = 512
  
  environment_variables = {
    SNS_TOPIC_ARN = module.sns_processing.topic_arn
    TAGS_TABLE    = module.dynamodb_videos.table_name
    OPENAI_API_KEY = var.openai_api_key
  }
  
  event_source_arn = module.sqs_auto_tagging.queue_arn
  
  tags = local.common_tags
}

# NestJS Services (ECS or Lambda)
module "ingestion_api" {
  source = "./modules/nest_service"
  
  service_name = "${local.name_prefix}-ingestion-api"
  
  # Container configuration
  container_image = "${local.account_id}.dkr.ecr.${local.region}.amazonaws.com/${local.name_prefix}-ingestion-api:latest"
  container_port  = 3001
  cpu            = 256
  memory         = 512
  
  # Environment variables
  environment_variables = {
    NODE_ENV = var.environment
    PORT     = "3001"
    
    # Database
    DYNAMODB_VIDEOS_TABLE = module.dynamodb_videos.table_name
    DYNAMODB_JOBS_TABLE   = module.dynamodb_jobs.table_name
    
    # Messaging
    SNS_TOPIC_ARN = module.sns_processing.topic_arn
    SQS_CAPTION_ANALYSIS_QUEUE = module.sqs_caption_analysis.queue_url
    SQS_THUMBNAIL_GENERATION_QUEUE = module.sqs_thumbnail_generation.queue_url
    SQS_AUTO_TAGGING_QUEUE = module.sqs_auto_tagging.queue_url
    
    # AWS
    AWS_REGION = local.region
  }
  
  # Auto scaling
  min_capacity = 1
  max_capacity = 10
  
  tags = local.common_tags
}

module "product_service" {
  source = "./modules/nest_service"
  
  service_name = "${local.name_prefix}-product-service"
  
  # Container configuration
  container_image = "${local.account_id}.dkr.ecr.${local.region}.amazonaws.com/${local.name_prefix}-product-service:latest"
  container_port  = 3002
  cpu            = 256
  memory         = 512
  
  # Environment variables
  environment_variables = {
    NODE_ENV = var.environment
    PORT     = "3002"
    
    # Database
    DYNAMODB_PRODUCTS_TABLE = module.dynamodb_products.table_name
    
    # Storage
    S3_BUCKET = module.s3_assets.bucket_name
    
    # AWS
    AWS_REGION = local.region
  }
  
  # Auto scaling
  min_capacity = 1
  max_capacity = 5
  
  tags = local.common_tags
}
