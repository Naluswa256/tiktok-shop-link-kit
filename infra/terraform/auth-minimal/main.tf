# Minimal Terraform configuration for Authentication feature only
# This deploys only the resources needed for the auth system

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Local variables
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "authentication"
    CreatedAt   = timestamp()
  }

  cognito_external_id = "${var.project_name}-external-id-${var.environment}"
}

# Variables
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "tiktok-commerce"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
  default     = ""
}

# DynamoDB table for users
resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # GSI for handle lookups
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # GSI for phone number lookups
  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "production"
  }

  # Server-side encryption
  server_side_encryption {
    enabled = true
  }

  # Deletion protection for production
  deletion_protection_enabled = var.environment == "production"

  tags = merge(local.common_tags, {
    Name    = "${var.project_name}-users-${var.environment}"
    Purpose = "User data storage"
  })
}

# IAM role for Cognito SMS
resource "aws_iam_role" "cognito_sms_role" {
  name = "${var.project_name}-cognito-sms-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "sts:ExternalId" = local.cognito_external_id
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM policy for SMS sending
resource "aws_iam_role_policy" "cognito_sms_policy" {
  name = "${var.project_name}-cognito-sms-policy-${var.environment}"
  role = aws_iam_role.cognito_sms_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-lambda-execution-role-${var.environment}"

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

# IAM policy attachment for Lambda basic execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda functions for Cognito custom auth flow
resource "aws_lambda_function" "create_auth_challenge" {
  filename         = "lambda-functions/create-auth-challenge.zip"
  function_name    = "${var.project_name}-create-auth-challenge-${var.environment}"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  source_code_hash = filebase64sha256("lambda-functions/create-auth-challenge.zip")

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "define_auth_challenge" {
  filename         = "lambda-functions/define-auth-challenge.zip"
  function_name    = "${var.project_name}-define-auth-challenge-${var.environment}"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  source_code_hash = filebase64sha256("lambda-functions/define-auth-challenge.zip")

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "verify_auth_challenge" {
  filename         = "lambda-functions/verify-auth-challenge.zip"
  function_name    = "${var.project_name}-verify-auth-challenge-${var.environment}"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  source_code_hash = filebase64sha256("lambda-functions/verify-auth-challenge.zip")

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.common_tags
}

# Cognito User Pool
resource "aws_cognito_user_pool" "tiktok_commerce" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # User attributes
  alias_attributes = ["phone_number"]

  # Required attributes
  schema {
    attribute_data_type = "String"
    name                = "phone_number"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 10
      max_length = 15
    }
  }

  # Custom attribute for TikTok handle
  schema {
    attribute_data_type = "String"
    name                = "tiktok_handle"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 2
      max_length = 24
    }
  }

  # MFA configuration - SMS only
  mfa_configuration = "OPTIONAL"

  sms_configuration {
    external_id    = local.cognito_external_id
    sns_caller_arn = aws_iam_role.cognito_sms_role.arn
    sns_region     = var.aws_region
  }

  # Auto-verified attributes
  auto_verified_attributes = ["phone_number"]

  # SMS verification message
  sms_verification_message = "Your TikTok Commerce verification code is {####}"

  # Lambda triggers for custom auth flow
  lambda_config {
    create_auth_challenge          = aws_lambda_function.create_auth_challenge.arn
    define_auth_challenge          = aws_lambda_function.define_auth_challenge.arn
    verify_auth_challenge_response = aws_lambda_function.verify_auth_challenge.arn
  }

  tags = local.common_tags
}

# User Pool Client
resource "aws_cognito_user_pool_client" "tiktok_commerce_client" {
  name         = "${var.project_name}-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.tiktok_commerce.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  access_token_validity  = 1  # 1 hour
  id_token_validity      = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  read_attributes = [
    "phone_number",
    "phone_number_verified",
    "custom:tiktok_handle"
  ]

  write_attributes = [
    "phone_number",
    "custom:tiktok_handle"
  ]
}

# Lambda permissions for Cognito
resource "aws_lambda_permission" "cognito_create_auth_challenge" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_auth_challenge.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.tiktok_commerce.arn
}

resource "aws_lambda_permission" "cognito_define_auth_challenge" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.define_auth_challenge.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.tiktok_commerce.arn
}

resource "aws_lambda_permission" "cognito_verify_auth_challenge" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.verify_auth_challenge.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.tiktok_commerce.arn
}

# Outputs
output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.tiktok_commerce.id
}

output "cognito_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.tiktok_commerce_client.id
}

output "dynamodb_users_table_name" {
  description = "Name of the DynamoDB users table"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_users_table_arn" {
  description = "ARN of the DynamoDB users table"
  value       = aws_dynamodb_table.users.arn
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}
