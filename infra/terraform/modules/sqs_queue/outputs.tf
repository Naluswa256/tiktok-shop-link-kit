# SQS Queue Module Outputs

output "queue_urls" {
  description = "URLs of the SQS queues"
  value       = { for k, v in aws_sqs_queue.queues : k => v.id }
}

output "queue_arns" {
  description = "ARNs of the SQS queues"
  value       = { for k, v in aws_sqs_queue.queues : k => v.arn }
}

output "queue_names" {
  description = "Names of the SQS queues"
  value       = { for k, v in aws_sqs_queue.queues : k => v.name }
}

output "dlq_urls" {
  description = "URLs of the dead letter queues"
  value       = { for k, v in aws_sqs_queue.dlq : k => v.id }
}

output "dlq_arns" {
  description = "ARNs of the dead letter queues"
  value       = { for k, v in aws_sqs_queue.dlq : k => v.arn }
}

output "dlq_names" {
  description = "Names of the dead letter queues"
  value       = { for k, v in aws_sqs_queue.dlq : k => v.name }
}
