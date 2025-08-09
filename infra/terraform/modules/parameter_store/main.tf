# Parameter Store Module

# Standard Parameters (non-sensitive configuration)
resource "aws_ssm_parameter" "standard" {
  for_each = var.standard_parameters

  name        = "/${var.name_prefix}/${each.key}"
  description = each.value.description
  type        = "String"
  value       = each.value.value
  tier        = try(each.value.tier, "Standard")

  tags = merge(var.tags, {
    Name        = "/${var.name_prefix}/${each.key}"
    Type        = "Configuration"
    Sensitive   = "false"
  })
}

# Secure String Parameters (sensitive configuration)
resource "aws_ssm_parameter" "secure" {
  for_each = var.secure_parameters

  name        = "/${var.name_prefix}/${each.key}"
  description = each.value.description
  type        = "SecureString"
  value       = each.value.value
  key_id      = var.kms_key_id
  tier        = try(each.value.tier, "Standard")

  tags = merge(var.tags, {
    Name        = "/${var.name_prefix}/${each.key}"
    Type        = "Configuration"
    Sensitive   = "true"
  })
}

# Application Configuration Parameters
resource "aws_ssm_parameter" "app_config" {
  for_each = local.app_config_parameters

  name        = "/${var.name_prefix}/config/${each.key}"
  description = each.value.description
  type        = each.value.type
  value       = each.value.value
  key_id      = each.value.type == "SecureString" ? var.kms_key_id : null
  tier        = "Standard"

  tags = merge(var.tags, {
    Name        = "/${var.name_prefix}/config/${each.key}"
    Type        = "ApplicationConfig"
    Sensitive   = each.value.type == "SecureString" ? "true" : "false"
  })
}

# Environment-specific parameters
resource "aws_ssm_parameter" "environment" {
  for_each = local.environment_parameters

  name        = "/${var.name_prefix}/env/${each.key}"
  description = each.value.description
  type        = "String"
  value       = each.value.value
  tier        = "Standard"

  tags = merge(var.tags, {
    Name        = "/${var.name_prefix}/env/${each.key}"
    Type        = "Environment"
    Sensitive   = "false"
  })
}

# Service-specific parameters
resource "aws_ssm_parameter" "service_config" {
  for_each = local.service_parameters

  name        = "/${var.name_prefix}/services/${each.value.service}/${each.key}"
  description = each.value.description
  type        = each.value.type
  value       = each.value.value
  key_id      = each.value.type == "SecureString" ? var.kms_key_id : null
  tier        = "Standard"

  tags = merge(var.tags, {
    Name        = "/${var.name_prefix}/services/${each.value.service}/${each.key}"
    Type        = "ServiceConfig"
    Service     = each.value.service
    Sensitive   = each.value.type == "SecureString" ? "true" : "false"
  })
}

# Local values for parameter organization
locals {
  # Application-wide configuration
  app_config_parameters = {
    aws_region = {
      description = "AWS region for the application"
      type        = "String"
      value       = var.aws_region
    }
    project_name = {
      description = "Project name"
      type        = "String"
      value       = var.project_name
    }
    environment = {
      description = "Environment name"
      type        = "String"
      value       = var.environment
    }
    cors_origins = {
      description = "Allowed CORS origins (comma-separated)"
      type        = "String"
      value       = join(",", var.cors_origins)
    }
    log_level = {
      description = "Application log level"
      type        = "String"
      value       = var.log_level
    }
  }

  # Environment-specific parameters
  environment_parameters = {
    node_env = {
      description = "Node.js environment"
      value       = var.environment == "prod" ? "production" : var.environment
    }
    enable_debug = {
      description = "Enable debug mode"
      value       = var.environment == "prod" ? "false" : "true"
    }
  }

  # Service-specific parameters
  service_parameters = merge(
    # Ingestion API parameters
    {
      for k, v in var.ingestion_api_config : "ingestion_api_${k}" => {
        service     = "ingestion-api"
        description = "Ingestion API ${k}"
        type        = "String"
        value       = tostring(v)
      }
    },
    # Product Service parameters
    {
      for k, v in var.product_service_config : "product_service_${k}" => {
        service     = "product-service"
        description = "Product Service ${k}"
        type        = "String"
        value       = tostring(v)
      }
    },
    # AI Workers parameters
    {
      for k, v in var.ai_workers_config : "ai_workers_${k}" => {
        service     = "ai-workers"
        description = "AI Workers ${k}"
        type        = contains(["openrouter_api_key", "openai_api_key"], k) ? "SecureString" : "String"
        value       = tostring(v)
      }
    }
  )
}

# Parameter hierarchy for easy retrieval
resource "aws_ssm_parameter" "parameter_hierarchy" {
  name        = "/${var.name_prefix}/hierarchy"
  description = "Parameter hierarchy for the application"
  type        = "String"
  value = jsonencode({
    config = {
      path        = "/${var.name_prefix}/config/"
      description = "Application-wide configuration"
    }
    env = {
      path        = "/${var.name_prefix}/env/"
      description = "Environment-specific parameters"
    }
    services = {
      path        = "/${var.name_prefix}/services/"
      description = "Service-specific configuration"
      services = {
        "ingestion-api" = "/${var.name_prefix}/services/ingestion-api/"
        "product-service" = "/${var.name_prefix}/services/product-service/"
        "ai-workers" = "/${var.name_prefix}/services/ai-workers/"
      }
    }
    aws_resources = {
      path        = "/${var.name_prefix}/aws/"
      description = "AWS resource identifiers"
    }
  })

  tags = merge(var.tags, {
    Name = "/${var.name_prefix}/hierarchy"
    Type = "Metadata"
  })
}
