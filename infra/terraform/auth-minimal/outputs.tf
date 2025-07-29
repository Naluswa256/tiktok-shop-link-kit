# Cognito Outputs
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

output "cognito_user_pool_endpoint" {
  description = "Endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.tiktok_commerce.endpoint
}

# DynamoDB Outputs
output "dynamodb_users_table_name" {
  description = "Name of the DynamoDB users table"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_users_table_arn" {
  description = "ARN of the DynamoDB users table"
  value       = aws_dynamodb_table.users.arn
}

output "dynamodb_shops_table_name" {
  description = "Name of the DynamoDB shops table"
  value       = aws_dynamodb_table.shops.name
}

output "dynamodb_shops_table_arn" {
  description = "ARN of the DynamoDB shops table"
  value       = aws_dynamodb_table.shops.arn
}

# Note: Using AWS managed encryption keys for simplicity

# Environment Configuration
output "environment_variables" {
  description = "Environment variables for the authentication service"
  value = {
    AWS_REGION               = var.aws_region
    COGNITO_USER_POOL_ID     = aws_cognito_user_pool.tiktok_commerce.id
    COGNITO_CLIENT_ID        = aws_cognito_user_pool_client.tiktok_commerce_client.id
    COGNITO_REGION           = var.aws_region
    DYNAMODB_USERS_TABLE     = aws_dynamodb_table.users.name
    DYNAMODB_SHOPS_TABLE     = aws_dynamodb_table.shops.name
    APIFY_ACTOR_ID          = var.apify_actor_id
    NODE_ENV                = var.environment
  }
  sensitive = false
}

# Deployment Summary
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    project_name      = var.project_name
    environment       = var.environment
    aws_region        = var.aws_region
    cognito_pool_id   = aws_cognito_user_pool.tiktok_commerce.id
    cognito_client_id = aws_cognito_user_pool_client.tiktok_commerce_client.id
    users_table       = aws_dynamodb_table.users.name
    shops_table       = aws_dynamodb_table.shops.name
    deployment_time   = timestamp()
  }
}
