# AWS Cognito User Pool for TikTok Commerce Link Hub
resource "aws_cognito_user_pool" "tiktok_commerce" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # User attributes
  alias_attributes = ["phone_number"]
  
  # Required attributes
  schema {
    attribute_data_type = "String"
    name               = "phone_number"
    required           = true
    mutable           = true
    
    string_attribute_constraints {
      min_length = 10
      max_length = 15
    }
  }

  # Custom attribute for TikTok handle
  schema {
    attribute_data_type = "String"
    name               = "tiktok_handle"
    required           = false
    mutable           = true
    
    string_attribute_constraints {
      min_length = 2
      max_length = 24
    }
  }

  # Password policy (not used for passwordless auth but required)
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # MFA configuration - SMS only
  mfa_configuration = "OPTIONAL"
  
  sms_configuration {
    external_id    = "${var.project_name}-external-id-${var.environment}"
    sns_caller_arn = aws_iam_role.cognito_sms_role.arn
    sns_region     = var.aws_region
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 1
    }
  }

  # User pool policies
  policies {
    password_policy {
      minimum_length    = 8
      require_lowercase = true
      require_numbers   = true
      require_symbols   = false
      require_uppercase = true
    }
  }

  # Auto-verified attributes
  auto_verified_attributes = ["phone_number"]

  # SMS verification message
  sms_verification_message = "Your TikTok Commerce verification code is {####}"

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  # Email configuration (optional)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Lambda triggers for custom auth flow
  lambda_config {
    create_auth_challenge          = aws_lambda_function.create_auth_challenge.arn
    define_auth_challenge          = aws_lambda_function.define_auth_challenge.arn
    verify_auth_challenge_response = aws_lambda_function.verify_auth_challenge.arn
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
  
  # Auth flows
  explicit_auth_flows = [
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
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

  # Read and write attributes
  read_attributes = [
    "phone_number",
    "phone_number_verified",
    "custom:tiktok_handle"
  ]

  write_attributes = [
    "phone_number",
    "custom:tiktok_handle"
  ]

  # OAuth settings (if needed for future integrations)
  supported_identity_providers = ["COGNITO"]
  
  callback_urls = [
    "http://localhost:3000/auth/callback",
    "https://${var.domain_name}/auth/callback"
  ]
  
  logout_urls = [
    "http://localhost:3000/auth/logout",
    "https://${var.domain_name}/auth/logout"
  ]

  allowed_oauth_flows = ["code"]
  allowed_oauth_scopes = ["openid", "email", "phone"]
  allowed_oauth_flows_user_pool_client = true
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
            "sts:ExternalId" = "${var.project_name}-external-id-${var.environment}"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-cognito-sms-role-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
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

# Lambda function for creating auth challenge
resource "aws_lambda_function" "create_auth_challenge" {
  filename         = "lambda/create-auth-challenge.zip"
  function_name    = "${var.project_name}-create-auth-challenge-${var.environment}"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = {
    Name        = "${var.project_name}-create-auth-challenge-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda function for defining auth challenge
resource "aws_lambda_function" "define_auth_challenge" {
  filename         = "lambda/define-auth-challenge.zip"
  function_name    = "${var.project_name}-define-auth-challenge-${var.environment}"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = {
    Name        = "${var.project_name}-define-auth-challenge-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda function for verifying auth challenge
resource "aws_lambda_function" "verify_auth_challenge" {
  filename         = "lambda/verify-auth-challenge.zip"
  function_name    = "${var.project_name}-verify-auth-challenge-${var.environment}"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = {
    Name        = "${var.project_name}-verify-auth-challenge-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
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

  tags = {
    Name        = "${var.project_name}-lambda-execution-role-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for Lambda execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
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

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.tiktok_commerce.arn
}
