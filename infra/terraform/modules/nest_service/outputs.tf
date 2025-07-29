output "service_name" {
  description = "Name of the service"
  value       = var.service_name
}

output "service_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.service.arn
}

output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.service.function_name
}

output "function_url" {
  description = "URL of the Lambda function"
  value       = aws_lambda_function_url.service_url.function_url
}

output "invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.service.invoke_arn
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = var.enable_logging ? aws_cloudwatch_log_group.service_logs[0].name : null
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = var.enable_logging ? aws_cloudwatch_log_group.service_logs[0].arn : null
}

output "execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}
