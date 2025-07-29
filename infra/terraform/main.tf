terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # backend "s3" {
  #   # Configure this in terraform init or backend config file
  #   # bucket = "buylink-us-east-1"
  #   # key    = "tiktok-commerce/terraform.tfstate"
  #   region = "us-east-1"
  # }
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
  hash_key   = "seller_handle"
  range_key  = "video_id"

  attributes = [
    {
      name = "seller_handle"
      type = "S"
    },
    {
      name = "video_id"
      type = "S"
    },
    {
      name = "category"
      type = "S"
    },
    {
      name = "created_at"
      type = "S"
    },
    {
      name = "status"
      type = "S"
    }
  ]

  global_secondary_indexes = [
    {
      name     = "CategoryIndex"
      hash_key = "category"
      range_key = "created_at"
      projection_type = "ALL"
    },
    {
      name     = "StatusIndex"
      hash_key = "status"
      range_key = "created_at"
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

module "dynamodb_shops" {
  source = "./modules/dynamodb"

  table_name = "${local.name_prefix}-shops"
  hash_key   = "handle"

  attributes = [
    {
      name = "handle"
      type = "S"
    },
    {
      name = "phone"
      type = "S"
    },
    {
      name = "created_at"
      type = "S"
    },
    {
      name = "subscription_status"
      type = "S"
    }
  ]

  global_secondary_indexes = [
    {
      name     = "PhoneIndex"
      hash_key = "phone"
      range_key = "created_at"
      projection_type = "ALL"
    },
    {
      name     = "SubscriptionIndex"
      hash_key = "subscription_status"
      range_key = "created_at"
      projection_type = "ALL"
    }
  ]

  tags = local.common_tags
}

module "dynamodb_analytics" {
  source = "./modules/dynamodb"

  table_name = "${local.name_prefix}-analytics"
  hash_key   = "shop_handle"
  range_key  = "timestamp"

  attributes = [
    {
      name = "shop_handle"
      type = "S"
    },
    {
      name = "timestamp"
      type = "S"
    },
    {
      name = "event_type"
      type = "S"
    },
    {
      name = "date"
      type = "S"
    }
  ]

  global_secondary_indexes = [
    {
      name     = "EventTypeIndex"
      hash_key = "event_type"
      range_key = "timestamp"
      projection_type = "ALL"
    },
    {
      name     = "DateIndex"
      hash_key = "date"
      range_key = "timestamp"
      projection_type = "ALL"
    }
  ]

  tags = local.common_tags
}

module "dynamodb_ingestion_state" {
  source = "./modules/dynamodb"

  table_name = "${local.name_prefix}-ingestion-state"
  hash_key   = "handle"

  attributes = [
    {
      name = "handle"
      type = "S"
    },
    {
      name = "last_run"
      type = "S"
    },
    {
      name = "status"
      type = "S"
    }
  ]

  global_secondary_indexes = [
    {
      name     = "StatusIndex"
      hash_key = "status"
      range_key = "last_run"
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

module "sns_new_video_posted" {
  source = "./modules/sns_topic"

  topic_name = "${local.name_prefix}-new-video-posted"

  # Create CloudWatch alarms for monitoring
  create_alarms = var.enable_detailed_monitoring
  error_threshold = 1

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

# SNS to SQS Subscriptions for fan-out from new-video-posted topic
resource "aws_sns_topic_subscription" "caption_analysis" {
  topic_arn = module.sns_new_video_posted.topic_arn
  protocol  = "sqs"
  endpoint  = module.sqs_caption_analysis.queue_arn
}

resource "aws_sns_topic_subscription" "thumbnail_generation" {
  topic_arn = module.sns_new_video_posted.topic_arn
  protocol  = "sqs"
  endpoint  = module.sqs_thumbnail_generation.queue_arn
}

resource "aws_sns_topic_subscription" "auto_tagging" {
  topic_arn = module.sns_new_video_posted.topic_arn
  protocol  = "sqs"
  endpoint  = module.sqs_auto_tagging.queue_arn
}

# SQS Queue Policies to allow SNS to send messages
resource "aws_sqs_queue_policy" "caption_analysis_policy" {
  queue_url = module.sqs_caption_analysis.queue_url

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = module.sqs_caption_analysis.queue_arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = module.sns_new_video_posted.topic_arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "thumbnail_generation_policy" {
  queue_url = module.sqs_thumbnail_generation.queue_url

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = module.sqs_thumbnail_generation.queue_arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = module.sns_new_video_posted.topic_arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "auto_tagging_policy" {
  queue_url = module.sqs_auto_tagging.queue_url

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = module.sqs_auto_tagging.queue_arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = module.sns_new_video_posted.topic_arn
          }
        }
      }
    ]
  })
}

# Scheduled Ingestion Lambda
resource "aws_lambda_function" "scheduled_ingestion" {
  filename         = "scheduled-ingestion.zip"
  function_name    = "${local.name_prefix}-scheduled-ingestion"
  role            = aws_iam_role.scheduled_ingestion_lambda_role.arn
  handler         = "scheduled-ingestion.handler"
  runtime         = "nodejs18.x"
  timeout         = 900  # 15 minutes
  memory_size     = 512

  environment {
    variables = {
      NODE_ENV                        = var.environment
      AWS_REGION                      = var.aws_region
      DYNAMODB_SHOPS_TABLE           = module.dynamodb_shops.table_name
      DYNAMODB_PRODUCTS_TABLE        = module.dynamodb_products.table_name
      DYNAMODB_INGESTION_STATE_TABLE = module.dynamodb_ingestion_state.table_name
      SNS_NEW_VIDEO_POSTED_TOPIC_ARN = module.sns_new_video_posted.topic_arn
      APIFY_TOKEN                    = var.apify_token
      APIFY_ACTOR_ID                 = var.apify_actor_id
    }
  }

  tags = local.common_tags
}

# IAM Role for Scheduled Ingestion Lambda
resource "aws_iam_role" "scheduled_ingestion_lambda_role" {
  name = "${local.name_prefix}-scheduled-ingestion-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM Policy for Scheduled Ingestion Lambda
resource "aws_iam_role_policy" "scheduled_ingestion_lambda_policy" {
  name = "${local.name_prefix}-scheduled-ingestion-lambda-policy"
  role = aws_iam_role.scheduled_ingestion_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          module.dynamodb_shops.table_arn,
          module.dynamodb_products.table_arn,
          module.dynamodb_ingestion_state.table_arn,
          "${module.dynamodb_shops.table_arn}/index/*",
          "${module.dynamodb_products.table_arn}/index/*",
          "${module.dynamodb_ingestion_state.table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = module.sns_new_video_posted.topic_arn
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

# EventBridge Rules for Scheduled Ingestion
resource "aws_cloudwatch_event_rule" "scheduled_ingestion_morning" {
  name                = "${local.name_prefix}-scheduled-ingestion-morning"
  description         = "Trigger ingestion job at 06:00 UTC daily"
  schedule_expression = "cron(0 6 * * ? *)"  # 06:00 UTC daily

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "scheduled_ingestion_evening" {
  name                = "${local.name_prefix}-scheduled-ingestion-evening"
  description         = "Trigger ingestion job at 18:00 UTC daily"
  schedule_expression = "cron(0 18 * * ? *)"  # 18:00 UTC daily

  tags = local.common_tags
}

# EventBridge Targets
resource "aws_cloudwatch_event_target" "scheduled_ingestion_morning_target" {
  rule      = aws_cloudwatch_event_rule.scheduled_ingestion_morning.name
  target_id = "ScheduledIngestionMorningTarget"
  arn       = aws_lambda_function.scheduled_ingestion.arn

  input = jsonencode({
    source      = "aws.events"
    detail-type = "Scheduled Event"
    detail = {
      schedule = "morning"
      time     = "06:00"
    }
  })
}

resource "aws_cloudwatch_event_target" "scheduled_ingestion_evening_target" {
  rule      = aws_cloudwatch_event_rule.scheduled_ingestion_evening.name
  target_id = "ScheduledIngestionEveningTarget"
  arn       = aws_lambda_function.scheduled_ingestion.arn

  input = jsonencode({
    source      = "aws.events"
    detail-type = "Scheduled Event"
    detail = {
      schedule = "evening"
      time     = "18:00"
    }
  })
}

# Lambda Permissions for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_morning" {
  statement_id  = "AllowExecutionFromEventBridgeMorning"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduled_ingestion.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled_ingestion_morning.arn
}

resource "aws_lambda_permission" "allow_eventbridge_evening" {
  statement_id  = "AllowExecutionFromEventBridgeEvening"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduled_ingestion.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled_ingestion_evening.arn
}

# S3 Bucket for Thumbnails
resource "aws_s3_bucket" "product_thumbnails" {
  bucket = "${local.name_prefix}-product-thumbnails"
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "product_thumbnails_versioning" {
  bucket = aws_s3_bucket.product_thumbnails.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "product_thumbnails_encryption" {
  bucket = aws_s3_bucket.product_thumbnails.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "product_thumbnails_lifecycle" {
  bucket = aws_s3_bucket.product_thumbnails.id

  rule {
    id     = "cleanup_old_thumbnails"
    status = "Enabled"

    expiration {
      days = 365 # Keep thumbnails for 1 year
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# AI Workers removed for authentication-only deployment

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
