# TikTok Commerce Link Hub - Main Terraform Configuration
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Backend configuration will be provided via backend config file
    # or terraform init -backend-config
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "tiktok-shop-link-kit"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  # Resource naming convention
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Common tags
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "tiktok-shop-link-kit"
  }

  # AZ selection (use first 2 available)
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name_prefix        = local.name_prefix
  cidr_block         = var.vpc_cidr
  availability_zones = local.availability_zones
  
  # Subnet configuration
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  
  # NAT Gateway configuration
  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway
  
  tags = local.common_tags
}

# ECR Repositories
module "ecr_repos" {
  source = "./modules/ecr_repo"

  repositories = [
    "${local.name_prefix}-ingestion-api",
    "${local.name_prefix}-product-service", 
    "${local.name_prefix}-thumbnail-generator",
    "${local.name_prefix}-caption-parser",
    "${local.name_prefix}-scheduled-ingestion"
  ]

  tags = local.common_tags
}

# ECS Cluster
module "ecs_cluster" {
  source = "./modules/ecs_cluster"

  name = "${local.name_prefix}-cluster"
  
  # Fargate configuration
  enable_fargate_capacity_providers = true
  enable_fargate_spot               = var.enable_fargate_spot
  
  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  name               = "${local.name_prefix}-alb"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.public_subnet_ids
  security_group_ids = [aws_security_group.alb.id]
  
  # SSL Configuration
  enable_https    = var.enable_https
  certificate_arn = var.certificate_arn
  
  tags = local.common_tags
}

# DynamoDB Tables
module "dynamodb_tables" {
  source = "./modules/dynamodb_table"

  tables = {
    users = {
      name           = "${local.name_prefix}-users"
      hash_key       = "PK"
      range_key      = "SK"
      billing_mode   = "ON_DEMAND"
      stream_enabled = false
      
      attributes = [
        { name = "PK", type = "S" },
        { name = "SK", type = "S" },
        { name = "GSI1PK", type = "S" },
        { name = "GSI1SK", type = "S" }
      ]
      
      global_secondary_indexes = [
        {
          name     = "GSI1"
          hash_key = "GSI1PK"
          range_key = "GSI1SK"
        }
      ]
    }
    
    shops = {
      name           = "${local.name_prefix}-shops"
      hash_key       = "PK"
      range_key      = "SK"
      billing_mode   = "ON_DEMAND"
      stream_enabled = false
      
      attributes = [
        { name = "PK", type = "S" },
        { name = "SK", type = "S" },
        { name = "GSI1PK", type = "S" },
        { name = "GSI1SK", type = "S" }
      ]
      
      global_secondary_indexes = [
        {
          name     = "GSI1"
          hash_key = "GSI1PK"
          range_key = "GSI1SK"
        }
      ]
    }
    
    products = {
      name           = "${local.name_prefix}-products"
      hash_key       = "PK"
      range_key      = "SK"
      billing_mode   = "ON_DEMAND"
      stream_enabled = false
      
      attributes = [
        { name = "PK", type = "S" },
        { name = "SK", type = "S" },
        { name = "GSI1PK", type = "S" },
        { name = "GSI1SK", type = "S" }
      ]
      
      global_secondary_indexes = [
        {
          name     = "GSI1"
          hash_key = "GSI1PK"
          range_key = "GSI1SK"
        }
      ]
    }
    
    admin_sessions = {
      name           = "${local.name_prefix}-admin-sessions"
      hash_key       = "PK"
      range_key      = "SK"
      billing_mode   = "ON_DEMAND"
      stream_enabled = false
      
      attributes = [
        { name = "PK", type = "S" },
        { name = "SK", type = "S" },
        { name = "GSI1PK", type = "S" },
        { name = "GSI1SK", type = "S" }
      ]
      
      global_secondary_indexes = [
        {
          name     = "GSI1"
          hash_key = "GSI1PK"
          range_key = "GSI1SK"
        }
      ]
    }
    
    ingestion_state = {
      name           = "${local.name_prefix}-ingestion-state"
      hash_key       = "PK"
      range_key      = "SK"
      billing_mode   = "ON_DEMAND"
      stream_enabled = false
      
      attributes = [
        { name = "PK", type = "S" },
        { name = "SK", type = "S" }
      ]
      
      global_secondary_indexes = []
    }
  }

  tags = local.common_tags
}

# SNS Topics
module "sns_topics" {
  source = "./modules/sns_topic"

  topics = {
    new_video_posted = {
      name         = "${local.name_prefix}-new-video-posted"
      display_name = "New Video Posted Events"
    }
  }

  tags = local.common_tags
}

# SQS Queues
module "sqs_queues" {
  source = "./modules/sqs_queue"

  queues = {
    thumbnail_generation = {
      name                       = "${local.name_prefix}-thumbnail-generation"
      visibility_timeout_seconds = 900  # 15 minutes for video processing
      message_retention_seconds  = 1209600  # 14 days
      max_receive_count          = 3
      dlq_name                   = "${local.name_prefix}-thumbnail-generation-dlq"
    }

    caption_parsing = {
      name                       = "${local.name_prefix}-caption-parsing"
      visibility_timeout_seconds = 300  # 5 minutes for caption processing
      message_retention_seconds  = 1209600  # 14 days
      max_receive_count          = 3
      dlq_name                   = "${local.name_prefix}-caption-parsing-dlq"
    }

    product_assembly = {
      name                       = "${local.name_prefix}-product-assembly"
      visibility_timeout_seconds = 600  # 10 minutes for assembly
      message_retention_seconds  = 1209600  # 14 days
      max_receive_count          = 3
      dlq_name                   = "${local.name_prefix}-product-assembly-dlq"
    }
  }

  # SNS subscriptions
  sns_subscriptions = {
    thumbnail_generation = {
      topic_arn = module.sns_topics.topic_arns["new_video_posted"]
      queue_name = "thumbnail_generation"
    }
    caption_parsing = {
      topic_arn = module.sns_topics.topic_arns["new_video_posted"]
      queue_name = "caption_parsing"
    }
    product_assembly = {
      topic_arn = module.sns_topics.topic_arns["new_video_posted"]
      queue_name = "product_assembly"
    }
  }

  tags = local.common_tags
}

# Cognito User Pool (moved before secrets_manager)
module "cognito" {
  source = "./modules/cognito"

  user_pool_name   = "${local.name_prefix}-sellers"
  user_pool_domain = "${local.name_prefix}-auth"

  # Client configuration
  client_name                = "${local.name_prefix}-client"
  callback_urls              = var.cognito_callback_urls
  logout_urls                = var.cognito_logout_urls
  supported_identity_providers = ["COGNITO"]

  tags = local.common_tags
}

# S3 Buckets
module "s3_buckets" {
  source = "./modules/s3_bucket"

  buckets = {
    thumbnails = {
      name = "${local.name_prefix}-thumbnails"

      # Lifecycle configuration for cost optimization
      lifecycle_rules = [
        {
          id     = "thumbnail_lifecycle"
          status = "Enabled"

          transitions = [
            {
              days          = 30
              storage_class = "STANDARD_IA"
            },
            {
              days          = 90
              storage_class = "GLACIER_IR"
            },
            {
              days          = 365
              storage_class = "DEEP_ARCHIVE"
            }
          ]
        }
      ]

      # CORS for frontend access
      cors_rules = [
        {
          allowed_headers = ["*"]
          allowed_methods = ["GET", "HEAD"]
          allowed_origins = var.cors_origins
          max_age_seconds = 3000
        }
      ]
    }

    logs = {
      name = "${local.name_prefix}-logs"

      lifecycle_rules = [
        {
          id     = "logs_lifecycle"
          status = "Enabled"

          expiration = {
            days = 90
          }
        }
      ]
    }
  }

  tags = local.common_tags
}

# ECS Services
module "ingestion_api_service" {
  source = "./modules/ecs_service"

  service_name    = "${local.name_prefix}-ingestion-api"
  cluster_id      = module.ecs_cluster.cluster_id
  cluster_name    = module.ecs_cluster.cluster_name
  container_image = "${module.ecr_repos.repository_urls["${local.name_prefix}-ingestion-api"]}:latest"

  # Resource configuration
  cpu    = var.ingestion_api_config.cpu
  memory = var.ingestion_api_config.memory

  # Scaling configuration
  desired_count = var.ingestion_api_config.min_capacity
  min_capacity  = var.ingestion_api_config.min_capacity
  max_capacity  = var.ingestion_api_config.max_capacity

  # Network configuration
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.ecs_tasks.id]

  # IAM roles
  execution_role_arn = module.iam_roles.ecs_task_execution_role_arn
  task_role_arn     = module.iam_roles.ingestion_api_task_role_arn

  # Load balancer
  target_group_arn = module.alb.target_group_arns["ingestion_api"]
  container_port   = 3001

  # Port mappings
  port_mappings = [
    {
      containerPort = 3001
      protocol      = "tcp"
    }
  ]

  # Environment variables
  environment_variables = {
    NODE_ENV                       = var.environment == "prod" ? "production" : var.environment
    PORT                          = "3001"
    LOG_LEVEL                     = var.environment == "prod" ? "info" : "debug"
    AWS_REGION                    = var.aws_region
    CORS_ORIGINS                  = join(",", var.cors_origins)
    DYNAMODB_USERS_TABLE          = module.dynamodb_tables.table_names["users"]
    DYNAMODB_SHOPS_TABLE          = module.dynamodb_tables.table_names["shops"]
    DYNAMODB_PRODUCTS_TABLE       = module.dynamodb_tables.table_names["products"]
    DYNAMODB_ADMIN_SESSIONS_TABLE = module.dynamodb_tables.table_names["admin_sessions"]
    DYNAMODB_INGESTION_STATE_TABLE = module.dynamodb_tables.table_names["ingestion_state"]
    SNS_NEW_VIDEO_POSTED_TOPIC_ARN = module.sns_topics.topic_arns["new_video_posted"]
    COGNITO_USER_POOL_ID          = module.cognito.user_pool_id
    ADMIN_USERNAME                = "admin@${var.domain_name}"
  }

  # Secrets from Secrets Manager
  secrets = {
    COGNITO_CLIENT_ID    = "${module.secrets_manager.secret_arns["cognito"]}:client_id::"
    JWT_SECRET           = "${module.secrets_manager.jwt_secret_arn}:jwt_secret::"
    JWT_SECRET_ADMIN     = "${module.secrets_manager.jwt_secret_arn}:jwt_admin_secret::"
    ADMIN_PASSWORD_HASH  = "${module.secrets_manager.jwt_secret_arn}:admin_password_hash::"
    APIFY_TOKEN          = "${module.secrets_manager.external_apis_secret_arn}:apify_token::"
  }

  # Auto scaling
  cpu_target_value = var.ingestion_api_config.target_cpu_percent

  # Capacity provider strategy for Spot
  capacity_provider_strategy = var.enable_fargate_spot ? [
    {
      capacity_provider = "FARGATE_SPOT"
      weight           = 2
      base             = 0
    },
    {
      capacity_provider = "FARGATE"
      weight           = 1
      base             = 1
    }
  ] : []

  tags = local.common_tags

  depends_on = [module.iam_roles]
}

module "product_service" {
  source = "./modules/ecs_service"

  service_name    = "${local.name_prefix}-product-service"
  cluster_id      = module.ecs_cluster.cluster_id
  cluster_name    = module.ecs_cluster.cluster_name
  container_image = "${module.ecr_repos.repository_urls["${local.name_prefix}-product-service"]}:latest"

  # Resource configuration
  cpu    = var.product_service_config.cpu
  memory = var.product_service_config.memory

  # Scaling configuration
  desired_count = var.product_service_config.min_capacity
  min_capacity  = var.product_service_config.min_capacity
  max_capacity  = var.product_service_config.max_capacity

  # Network configuration
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.ecs_tasks.id]

  # IAM roles
  execution_role_arn = module.iam_roles.ecs_task_execution_role_arn
  task_role_arn     = module.iam_roles.product_service_task_role_arn

  # Load balancer
  target_group_arn = module.alb.target_group_arns["product_service"]
  container_port   = 3002

  # Port mappings
  port_mappings = [
    {
      containerPort = 3002
      protocol      = "tcp"
    }
  ]

  # Environment variables
  environment_variables = {
    NODE_ENV                    = var.environment == "prod" ? "production" : var.environment
    PORT                       = "3002"
    LOG_LEVEL                  = var.environment == "prod" ? "info" : "debug"
    AWS_REGION                 = var.aws_region
    ALLOWED_ORIGINS            = join(",", var.cors_origins)
    DYNAMODB_PRODUCTS_TABLE    = module.dynamodb_tables.table_names["products"]
    SQS_QUEUE_URL              = module.sqs_queues.queue_urls["product_assembly"]
    SNS_TOPIC_ARN              = module.sns_topics.topic_arns["new_video_posted"]
  }

  # Auto scaling
  cpu_target_value = var.product_service_config.target_cpu_percent

  # Capacity provider strategy for Spot
  capacity_provider_strategy = var.enable_fargate_spot ? [
    {
      capacity_provider = "FARGATE_SPOT"
      weight           = 2
      base             = 0
    },
    {
      capacity_provider = "FARGATE"
      weight           = 1
      base             = 1
    }
  ] : []

  tags = local.common_tags

  depends_on = [module.iam_roles]
}

module "thumbnail_generator_service" {
  source = "./modules/ecs_service"

  service_name    = "${local.name_prefix}-thumbnail-generator"
  cluster_id      = module.ecs_cluster.cluster_id
  cluster_name    = module.ecs_cluster.cluster_name
  container_image = "${module.ecr_repos.repository_urls["${local.name_prefix}-thumbnail-generator"]}:latest"

  # Resource configuration
  cpu    = var.thumbnail_generator_config.cpu
  memory = var.thumbnail_generator_config.memory

  # Scaling configuration
  desired_count = 0  # Start with 0, scale based on SQS
  min_capacity  = var.thumbnail_generator_config.min_capacity
  max_capacity  = var.thumbnail_generator_config.max_capacity

  # Network configuration
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.ecs_tasks.id]

  # IAM roles
  execution_role_arn = module.iam_roles.ecs_task_execution_role_arn
  task_role_arn     = module.iam_roles.ai_workers_task_role_arn

  # No load balancer for workers
  target_group_arn = null

  # Port mappings for health check
  port_mappings = [
    {
      containerPort = 8080
      protocol      = "tcp"
    }
  ]

  # Environment variables
  environment_variables = {
    NODE_ENV                    = var.environment == "prod" ? "production" : var.environment
    AWS_REGION                  = var.aws_region
    SQS_QUEUE_URL               = module.sqs_queues.queue_urls["thumbnail_generation"]
    SNS_TOPIC_ARN               = module.sns_topics.topic_arns["new_video_posted"]
    S3_BUCKET_NAME              = module.s3_buckets.bucket_names["thumbnails"]
    MAX_VIDEO_SIZE_MB           = "300"
    MAX_VIDEO_DURATION_SECONDS  = "3600"
    THUMBNAILS_TO_GENERATE      = "5"
    YOLO_MODEL_PATH             = "yolov8n.pt"
  }

  # SQS-based scaling
  sqs_queue_name   = module.sqs_queues.queue_names["thumbnail_generation"]
  sqs_target_value = 5

  # Capacity provider strategy for Spot (workers benefit most)
  capacity_provider_strategy = var.enable_fargate_spot ? [
    {
      capacity_provider = "FARGATE_SPOT"
      weight           = 4
      base             = 0
    },
    {
      capacity_provider = "FARGATE"
      weight           = 1
      base             = 0
    }
  ] : []

  tags = local.common_tags

  depends_on = [module.iam_roles]
}

module "caption_parser_service" {
  source = "./modules/ecs_service"

  service_name    = "${local.name_prefix}-caption-parser"
  cluster_id      = module.ecs_cluster.cluster_id
  cluster_name    = module.ecs_cluster.cluster_name
  container_image = "${module.ecr_repos.repository_urls["${local.name_prefix}-caption-parser"]}:latest"

  # Resource configuration
  cpu    = var.caption_parser_config.cpu
  memory = var.caption_parser_config.memory

  # Scaling configuration
  desired_count = 0  # Start with 0, scale based on SQS
  min_capacity  = var.caption_parser_config.min_capacity
  max_capacity  = var.caption_parser_config.max_capacity

  # Network configuration
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.ecs_tasks.id]

  # IAM roles
  execution_role_arn = module.iam_roles.ecs_task_execution_role_arn
  task_role_arn     = module.iam_roles.ai_workers_task_role_arn

  # No load balancer for workers
  target_group_arn = null

  # Port mappings for health check
  port_mappings = [
    {
      containerPort = 8080
      protocol      = "tcp"
    }
  ]

  # Environment variables
  environment_variables = {
    NODE_ENV          = var.environment == "prod" ? "production" : var.environment
    AWS_REGION        = var.aws_region
    SQS_QUEUE_URL     = module.sqs_queues.queue_urls["caption_parsing"]
    SNS_TOPIC_ARN     = module.sns_topics.topic_arns["new_video_posted"]
    LLM_PROVIDER      = "openrouter"
    LLM_MODEL         = "microsoft/phi-3-mini-128k-instruct"
  }

  # Secrets from Secrets Manager
  secrets = {
    OPENROUTER_API_KEY = "${module.secrets_manager.external_apis_secret_arn}:openrouter_api_key::"
  }

  # SQS-based scaling
  sqs_queue_name   = module.sqs_queues.queue_names["caption_parsing"]
  sqs_target_value = 10

  # Capacity provider strategy for Spot
  capacity_provider_strategy = var.enable_fargate_spot ? [
    {
      capacity_provider = "FARGATE_SPOT"
      weight           = 4
      base             = 0
    },
    {
      capacity_provider = "FARGATE"
      weight           = 1
      base             = 0
    }
  ] : []

  tags = local.common_tags

  depends_on = [module.iam_roles]
}

# IAM Roles
module "iam_roles" {
  source = "./modules/iam_roles"

  name_prefix = local.name_prefix

  # Resource ARNs for IAM policies
  dynamodb_table_arns   = values(module.dynamodb_tables.table_arns)
  sns_topic_arns        = values(module.sns_topics.topic_arns)
  sqs_queue_arns        = values(module.sqs_queues.queue_arns)
  s3_bucket_arns        = values(module.s3_buckets.bucket_arns)
  cognito_user_pool_arn = module.cognito.user_pool_arn

  tags = local.common_tags
}

# Parameter Store
module "parameter_store" {
  source = "./modules/parameter_store"

  name_prefix  = local.name_prefix
  aws_region   = var.aws_region
  project_name = var.project_name
  environment  = var.environment
  cors_origins = var.cors_origins
  log_level    = var.environment == "prod" ? "info" : "debug"

  # Service configurations
  ingestion_api_config = {
    port                = "3001"
    cpu                 = tostring(var.ingestion_api_config.cpu)
    memory              = tostring(var.ingestion_api_config.memory)
    min_capacity        = tostring(var.ingestion_api_config.min_capacity)
    max_capacity        = tostring(var.ingestion_api_config.max_capacity)
    target_cpu_percent  = tostring(var.ingestion_api_config.target_cpu_percent)
    apify_actor_id      = var.apify_actor_id
  }

  product_service_config = {
    port                = "3002"
    cpu                 = tostring(var.product_service_config.cpu)
    memory              = tostring(var.product_service_config.memory)
    min_capacity        = tostring(var.product_service_config.min_capacity)
    max_capacity        = tostring(var.product_service_config.max_capacity)
    target_cpu_percent  = tostring(var.product_service_config.target_cpu_percent)
  }

  ai_workers_config = {
    thumbnail_cpu          = tostring(var.thumbnail_generator_config.cpu)
    thumbnail_memory       = tostring(var.thumbnail_generator_config.memory)
    thumbnail_min_capacity = tostring(var.thumbnail_generator_config.min_capacity)
    thumbnail_max_capacity = tostring(var.thumbnail_generator_config.max_capacity)
    caption_cpu            = tostring(var.caption_parser_config.cpu)
    caption_memory         = tostring(var.caption_parser_config.memory)
    caption_min_capacity   = tostring(var.caption_parser_config.min_capacity)
    caption_max_capacity   = tostring(var.caption_parser_config.max_capacity)
    max_video_size_mb      = "300"
    max_video_duration_seconds = "3600"
    thumbnails_to_generate = "5"
    yolo_model_path        = "yolov8n.pt"
    llm_provider           = "openrouter"
    llm_model              = "microsoft/phi-3-mini-128k-instruct"
  }

  # AWS resource references for applications
  standard_parameters = {
    # DynamoDB Table Names
    "aws/dynamodb/users_table" = {
      description = "DynamoDB Users table name"
      value       = module.dynamodb_tables.table_names["users"]
    }
    "aws/dynamodb/shops_table" = {
      description = "DynamoDB Shops table name"
      value       = module.dynamodb_tables.table_names["shops"]
    }
    "aws/dynamodb/products_table" = {
      description = "DynamoDB Products table name"
      value       = module.dynamodb_tables.table_names["products"]
    }
    "aws/dynamodb/admin_sessions_table" = {
      description = "DynamoDB Admin Sessions table name"
      value       = module.dynamodb_tables.table_names["admin_sessions"]
    }
    "aws/dynamodb/ingestion_state_table" = {
      description = "DynamoDB Ingestion State table name"
      value       = module.dynamodb_tables.table_names["ingestion_state"]
    }

    # SNS Topic ARNs
    "aws/sns/new_video_posted_topic_arn" = {
      description = "SNS New Video Posted topic ARN"
      value       = module.sns_topics.topic_arns["new_video_posted"]
    }

    # SQS Queue URLs
    "aws/sqs/thumbnail_generation_queue_url" = {
      description = "SQS Thumbnail Generation queue URL"
      value       = module.sqs_queues.queue_urls["thumbnail_generation"]
    }
    "aws/sqs/caption_parsing_queue_url" = {
      description = "SQS Caption Parsing queue URL"
      value       = module.sqs_queues.queue_urls["caption_parsing"]
    }
    "aws/sqs/product_assembly_queue_url" = {
      description = "SQS Product Assembly queue URL"
      value       = module.sqs_queues.queue_urls["product_assembly"]
    }

    # S3 Bucket Names
    "aws/s3/thumbnails_bucket_name" = {
      description = "S3 Thumbnails bucket name"
      value       = module.s3_buckets.bucket_names["thumbnails"]
    }

    # Cognito Configuration
    "aws/cognito/user_pool_id" = {
      description = "Cognito User Pool ID"
      value       = module.cognito.user_pool_id
    }

    # ALB Configuration
    "aws/alb/dns_name" = {
      description = "Application Load Balancer DNS name"
      value       = module.alb.dns_name
    }
  }

  tags = local.common_tags
}

# Secrets Manager
module "secrets_manager" {
  source = "./modules/secrets_manager"

  name_prefix = local.name_prefix

  # External API secrets
  apify_token        = var.apify_token
  openrouter_api_key = var.openrouter_api_key

  # Cognito configuration
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.user_pool_client_id
  cognito_client_secret = module.cognito.user_pool_client_secret

  # Admin configuration
  admin_username = "admin@${var.domain_name}"

  tags = local.common_tags
}

# CloudWatch Alerts and Monitoring (moved before EventBridge)
module "cloudwatch_alerts" {
  source = "./modules/cloudwatch_alerts"

  name_prefix       = local.name_prefix
  cluster_name      = module.ecs_cluster.cluster_name
  alb_arn_suffix    = module.alb.arn_suffix
  notification_email = var.notification_email

  enable_budget_alerts = var.environment == "prod"
  budget_limit_usd     = var.budget_limit_usd

  tags = local.common_tags
}

# EventBridge for Scheduled Ingestion
module "eventbridge" {
  source = "./modules/eventbridge"

  name_prefix = local.name_prefix

  # Lambda configuration
  create_lambda_function    = true
  lambda_execution_role_arn = module.iam_roles.lambda_execution_role_arn
  lambda_image_uri          = "${module.ecr_repos.repository_urls["${local.name_prefix}-scheduled-ingestion"]}:latest"
  lambda_timeout            = 300
  lambda_memory_size        = 512

  # Environment variables for Lambda
  lambda_environment_variables = {
    NODE_ENV                       = var.environment == "prod" ? "production" : var.environment
    AWS_REGION                     = var.aws_region
    DYNAMODB_USERS_TABLE          = module.dynamodb_tables.table_names["users"]
    DYNAMODB_SHOPS_TABLE          = module.dynamodb_tables.table_names["shops"]
    DYNAMODB_INGESTION_STATE_TABLE = module.dynamodb_tables.table_names["ingestion_state"]
    SNS_NEW_VIDEO_POSTED_TOPIC_ARN = module.sns_topics.topic_arns["new_video_posted"]
    APIFY_TOKEN_SECRET_ARN         = module.secrets_manager.external_apis_secret_arn
  }

  # VPC configuration for Lambda
  lambda_vpc_config = {
    subnet_ids         = module.vpc.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  enable_xray_tracing = var.environment == "prod"
  enable_monitoring   = true
  alarm_actions       = [module.cloudwatch_alerts.alerts_topic_arn]

  tags = local.common_tags

  depends_on = [module.iam_roles]
}
