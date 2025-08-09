# ECR Repository Module Outputs

output "repository_arns" {
  description = "ARNs of the ECR repositories"
  value       = { for k, v in aws_ecr_repository.repos : k => v.arn }
}

output "repository_urls" {
  description = "URLs of the ECR repositories"
  value       = { for k, v in aws_ecr_repository.repos : k => v.repository_url }
}

output "repository_names" {
  description = "Names of the ECR repositories"
  value       = { for k, v in aws_ecr_repository.repos : k => v.name }
}

output "registry_ids" {
  description = "Registry IDs of the ECR repositories"
  value       = { for k, v in aws_ecr_repository.repos : k => v.registry_id }
}
