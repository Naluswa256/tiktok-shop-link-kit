# IAM Roles Module Outputs

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ingestion_api_task_role_arn" {
  description = "ARN of the Ingestion API task role"
  value       = aws_iam_role.ingestion_api_task.arn
}

output "product_service_task_role_arn" {
  description = "ARN of the Product Service task role"
  value       = aws_iam_role.product_service_task.arn
}

output "ai_workers_task_role_arn" {
  description = "ARN of the AI Workers task role"
  value       = aws_iam_role.ai_workers_task.arn
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "role_arns" {
  description = "Map of all role ARNs"
  value = {
    ecs_task_execution    = aws_iam_role.ecs_task_execution.arn
    ingestion_api_task    = aws_iam_role.ingestion_api_task.arn
    product_service_task  = aws_iam_role.product_service_task.arn
    ai_workers_task       = aws_iam_role.ai_workers_task.arn
    lambda_execution      = aws_iam_role.lambda_execution.arn
  }
}
