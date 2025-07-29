# AWS Cognito User Pool for TikTok Commerce Link Hub
resource "aws_cognito_user_pool" "tiktok_commerce" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # Use username (TikTok handle) as primary sign-in attribute
  # No alias attributes needed for simple username/password auth

  # Password policy for standard authentication
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # No MFA configuration for simplified auth
  mfa_configuration = "OFF"

  # Email configuration for password reset
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  tags = {
    Name        = "${var.project_name}-user-pool-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "tiktok_commerce_client" {
  name         = "${var.project_name}-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.tiktok_commerce.id

  # Client settings
  generate_secret = false
  
  # Auth flows - simplified for username/password authentication
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Token validity
  access_token_validity  = 1  # 1 hour
  id_token_validity     = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Simplified attributes for username/password auth
  # No special read/write attributes needed for basic auth
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

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.tiktok_commerce.arn
}


