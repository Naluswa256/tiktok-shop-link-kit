# EventBridge Module Outputs

output "morning_rule_arn" {
  description = "ARN of the morning scheduled ingestion rule"
  value       = aws_cloudwatch_event_rule.scheduled_ingestion_morning.arn
}

output "evening_rule_arn" {
  description = "ARN of the evening scheduled ingestion rule"
  value       = aws_cloudwatch_event_rule.scheduled_ingestion_evening.arn
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = var.create_lambda_function ? aws_lambda_function.scheduled_ingestion[0].arn : null
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = var.create_lambda_function ? aws_lambda_function.scheduled_ingestion[0].function_name : null
}

output "lambda_log_group_name" {
  description = "Name of the Lambda CloudWatch log group"
  value       = var.create_lambda_function ? aws_cloudwatch_log_group.lambda[0].name : null
}
