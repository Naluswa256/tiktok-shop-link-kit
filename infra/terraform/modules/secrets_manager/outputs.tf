# Secrets Manager Module Outputs

output "secret_arns" {
  description = "ARNs of all secrets"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.arn },
    { for k, v in aws_secretsmanager_secret.app_secrets : k => v.arn },
    {
      jwt_secrets     = aws_secretsmanager_secret.jwt_secrets.arn
      external_apis   = aws_secretsmanager_secret.external_apis.arn
      database        = var.create_database_secret ? aws_secretsmanager_secret.database[0].arn : null
    }
  )
}

output "secret_names" {
  description = "Names of all secrets"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.name },
    { for k, v in aws_secretsmanager_secret.app_secrets : k => v.name },
    {
      jwt_secrets     = aws_secretsmanager_secret.jwt_secrets.name
      external_apis   = aws_secretsmanager_secret.external_apis.name
      database        = var.create_database_secret ? aws_secretsmanager_secret.database[0].name : null
    }
  )
}

output "jwt_secret_arn" {
  description = "ARN of the JWT secrets"
  value       = aws_secretsmanager_secret.jwt_secrets.arn
}

output "external_apis_secret_arn" {
  description = "ARN of the external APIs secret"
  value       = aws_secretsmanager_secret.external_apis.arn
}

output "database_secret_arn" {
  description = "ARN of the database secret"
  value       = var.create_database_secret ? aws_secretsmanager_secret.database[0].arn : null
}

output "secret_hierarchy" {
  description = "Secret hierarchy information"
  value = {
    app_path      = "${var.name_prefix}/app/"
    auth_path     = "${var.name_prefix}/auth/"
    external_path = "${var.name_prefix}/external/"
    database_path = "${var.name_prefix}/database/"
  }
}
