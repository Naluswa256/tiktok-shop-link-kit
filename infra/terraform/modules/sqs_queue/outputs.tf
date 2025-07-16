output "queue_url" {
  description = "URL of the SQS queue"
  value       = aws_sqs_queue.this.url
}

output "queue_arn" {
  description = "ARN of the SQS queue"
  value       = aws_sqs_queue.this.arn
}

output "queue_name" {
  description = "Name of the SQS queue"
  value       = aws_sqs_queue.this.name
}

output "dlq_url" {
  description = "URL of the dead letter queue (if enabled)"
  value       = var.dead_letter_queue_enabled ? aws_sqs_queue.dlq[0].url : null
}

output "dlq_arn" {
  description = "ARN of the dead letter queue (if enabled)"
  value       = var.dead_letter_queue_enabled ? aws_sqs_queue.dlq[0].arn : null
}

output "dlq_name" {
  description = "Name of the dead letter queue (if enabled)"
  value       = var.dead_letter_queue_enabled ? aws_sqs_queue.dlq[0].name : null
}

output "consume_policy_arn" {
  description = "ARN of the consume policy (if created)"
  value       = var.create_consume_policy ? aws_iam_policy.sqs_consume[0].arn : null
}

output "consume_policy_name" {
  description = "Name of the consume policy (if created)"
  value       = var.create_consume_policy ? aws_iam_policy.sqs_consume[0].name : null
}

output "send_policy_arn" {
  description = "ARN of the send policy (if created)"
  value       = var.create_send_policy ? aws_iam_policy.sqs_send[0].arn : null
}

output "send_policy_name" {
  description = "Name of the send policy (if created)"
  value       = var.create_send_policy ? aws_iam_policy.sqs_send[0].name : null
}
