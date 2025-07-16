# DynamoDB table for users
resource "aws_dynamodb_table" "users" {
  name           = "${var.project_name}-users-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 for handle lookups
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI2 for phone number lookups
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # Global Secondary Index for handle lookups
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"
  }

  # Global Secondary Index for phone number lookups
  global_secondary_index {
    name     = "GSI2"
    hash_key = "GSI2PK"
    range_key = "GSI2SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup (optional)
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "production" ? true : false
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_id  = var.environment == "production" ? aws_kms_key.dynamodb_key[0].arn : null
  }

  # Deletion protection for production
  deletion_protection_enabled = var.environment == "production" ? true : false

  tags = {
    Name        = "${var.project_name}-users-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "User data storage"
  }
}

# KMS key for DynamoDB encryption (production only)
resource "aws_kms_key" "dynamodb_key" {
  count = var.environment == "production" ? 1 : 0
  
  description             = "KMS key for DynamoDB encryption - ${var.project_name} ${var.environment}"
  deletion_window_in_days = 7

  tags = {
    Name        = "${var.project_name}-dynamodb-key-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# KMS key alias
resource "aws_kms_alias" "dynamodb_key_alias" {
  count = var.environment == "production" ? 1 : 0
  
  name          = "alias/${var.project_name}-dynamodb-${var.environment}"
  target_key_id = aws_kms_key.dynamodb_key[0].key_id
}

# DynamoDB table for shop links (optional - for future use)
resource "aws_dynamodb_table" "shop_links" {
  name           = "${var.project_name}-shop-links-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI for user lookups
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # Global Secondary Index for user lookups
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "production" ? true : false
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_id  = var.environment == "production" ? aws_kms_key.dynamodb_key[0].arn : null
  }

  # Deletion protection for production
  deletion_protection_enabled = var.environment == "production" ? true : false

  tags = {
    Name        = "${var.project_name}-shop-links-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "Shop link data storage"
  }
}

# DynamoDB table for analytics (optional - for future use)
resource "aws_dynamodb_table" "analytics" {
  name           = "${var.project_name}-analytics-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI for time-based queries
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # Global Secondary Index for time-based queries
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup (analytics data retention)
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "production" ? true : false
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_id  = var.environment == "production" ? aws_kms_key.dynamodb_key[0].arn : null
  }

  tags = {
    Name        = "${var.project_name}-analytics-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "Analytics data storage"
  }
}

# CloudWatch alarms for DynamoDB monitoring
resource "aws_cloudwatch_metric_alarm" "users_table_throttles" {
  alarm_name          = "${var.project_name}-users-throttles-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB throttles for users table"
  alarm_actions       = var.environment == "production" ? [aws_sns_topic.alerts[0].arn] : []

  dimensions = {
    TableName = aws_dynamodb_table.users.name
  }

  tags = {
    Name        = "${var.project_name}-users-throttles-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_metric_alarm" "users_table_errors" {
  alarm_name          = "${var.project_name}-users-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB system errors for users table"
  alarm_actions       = var.environment == "production" ? [aws_sns_topic.alerts[0].arn] : []

  dimensions = {
    TableName = aws_dynamodb_table.users.name
  }

  tags = {
    Name        = "${var.project_name}-users-errors-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# SNS topic for alerts (production only)
resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0
  
  name = "${var.project_name}-alerts-${var.environment}"

  tags = {
    Name        = "${var.project_name}-alerts-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Outputs
output "dynamodb_users_table_name" {
  description = "Name of the DynamoDB users table"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_users_table_arn" {
  description = "ARN of the DynamoDB users table"
  value       = aws_dynamodb_table.users.arn
}

output "dynamodb_shop_links_table_name" {
  description = "Name of the DynamoDB shop links table"
  value       = aws_dynamodb_table.shop_links.name
}

output "dynamodb_analytics_table_name" {
  description = "Name of the DynamoDB analytics table"
  value       = aws_dynamodb_table.analytics.name
}
