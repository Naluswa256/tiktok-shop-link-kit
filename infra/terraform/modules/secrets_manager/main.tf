# Secrets Manager Module

# Secrets Manager Secrets
resource "aws_secretsmanager_secret" "secrets" {
  for_each = var.secrets

  name                    = "${var.name_prefix}/${each.key}"
  description             = each.value.description
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days

  # Replica configuration for cross-region replication
  dynamic "replica" {
    for_each = var.enable_cross_region_replica ? var.replica_regions : []
    content {
      region     = replica.value
      kms_key_id = var.replica_kms_key_id
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}/${each.key}"
    Type = "Secret"
  })
}

# Secret Versions
resource "aws_secretsmanager_secret_version" "secrets" {
  for_each = var.secrets

  secret_id = aws_secretsmanager_secret.secrets[each.key].id
  
  secret_string = each.value.type == "json" ? jsonencode(each.value.value) : each.value.value

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Application-specific secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  for_each = local.application_secrets

  name                    = "${var.name_prefix}/app/${each.key}"
  description             = each.value.description
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, {
    Name        = "${var.name_prefix}/app/${each.key}"
    Type        = "ApplicationSecret"
    Application = each.value.application
  })
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  for_each = local.application_secrets

  secret_id     = aws_secretsmanager_secret.app_secrets[each.key].id
  secret_string = each.value.type == "json" ? jsonencode(each.value.value) : each.value.value

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Database credentials (if needed for future RDS integration)
resource "aws_secretsmanager_secret" "database" {
  count = var.create_database_secret ? 1 : 0

  name                    = "${var.name_prefix}/database/credentials"
  description             = "Database credentials for ${var.name_prefix}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}/database/credentials"
    Type = "DatabaseSecret"
  })
}

resource "aws_secretsmanager_secret_version" "database" {
  count = var.create_database_secret ? 1 : 0

  secret_id = aws_secretsmanager_secret.database[0].id
  
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    engine   = var.database_engine
    host     = var.database_host
    port     = var.database_port
    dbname   = var.database_name
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# JWT secrets for authentication
resource "aws_secretsmanager_secret" "jwt_secrets" {
  name                    = "${var.name_prefix}/auth/jwt"
  description             = "JWT secrets for authentication"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}/auth/jwt"
    Type = "AuthSecret"
  })
}

resource "aws_secretsmanager_secret_version" "jwt_secrets" {
  secret_id = aws_secretsmanager_secret.jwt_secrets.id
  
  secret_string = jsonencode({
    jwt_secret       = var.jwt_secret != "" ? var.jwt_secret : random_password.jwt_secret.result
    jwt_admin_secret = var.jwt_admin_secret != "" ? var.jwt_admin_secret : random_password.jwt_admin_secret.result
    admin_password_hash = var.admin_password_hash
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Generate random JWT secrets if not provided
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "jwt_admin_secret" {
  length  = 64
  special = true
}

# External API secrets
resource "aws_secretsmanager_secret" "external_apis" {
  name                    = "${var.name_prefix}/external/apis"
  description             = "External API keys and tokens"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}/external/apis"
    Type = "ExternalAPISecret"
  })
}

resource "aws_secretsmanager_secret_version" "external_apis" {
  secret_id = aws_secretsmanager_secret.external_apis.id
  
  secret_string = jsonencode({
    apify_token        = var.apify_token
    openrouter_api_key = var.openrouter_api_key
    openai_api_key     = var.openai_api_key
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Secret rotation configuration (for database secrets)
resource "aws_secretsmanager_secret_rotation" "database" {
  count = var.create_database_secret && var.enable_secret_rotation ? 1 : 0

  secret_id           = aws_secretsmanager_secret.database[0].id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}

# Local values for application secrets
locals {
  application_secrets = {
    cognito = {
      description = "Cognito configuration"
      application = "auth"
      type        = "json"
      value = {
        user_pool_id     = var.cognito_user_pool_id
        client_id        = var.cognito_client_id
        client_secret    = var.cognito_client_secret
      }
    }
    
    admin_config = {
      description = "Admin portal configuration"
      application = "admin"
      type        = "json"
      value = {
        username     = var.admin_username
        refresh_cookie_name = var.admin_refresh_cookie_name
      }
    }
  }
}
