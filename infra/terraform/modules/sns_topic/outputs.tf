output "topic_arn" {
  description = "ARN of the SNS topic"
  value       = aws_sns_topic.this.arn
}

output "topic_name" {
  description = "Name of the SNS topic"
  value       = aws_sns_topic.this.name
}

output "topic_id" {
  description = "ID of the SNS topic"
  value       = aws_sns_topic.this.id
}

output "publish_policy_arn" {
  description = "ARN of the publish policy (if created)"
  value       = var.create_publish_policy ? aws_iam_policy.sns_publish[0].arn : null
}

output "publish_policy_name" {
  description = "Name of the publish policy (if created)"
  value       = var.create_publish_policy ? aws_iam_policy.sns_publish[0].name : null
}
