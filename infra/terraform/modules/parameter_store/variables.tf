# Parameter Store Module Variables

variable "name_prefix" {
  description = "Name prefix for parameters"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cors_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = []
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "kms_key_id" {
  description = "KMS key ID for SecureString parameters"
  type        = string
  default     = "alias/aws/ssm"
}

# Standard (non-sensitive) parameters
variable "standard_parameters" {
  description = "Map of standard parameters"
  type = map(object({
    description = string
    value       = string
    tier        = optional(string, "Standard")
  }))
  default = {}
}

# Secure (sensitive) parameters
variable "secure_parameters" {
  description = "Map of secure parameters"
  type = map(object({
    description = string
    value       = string
    tier        = optional(string, "Standard")
  }))
  default   = {}
  sensitive = true
}

# Service-specific configuration
variable "ingestion_api_config" {
  description = "Configuration for Ingestion API service"
  type        = map(string)
  default     = {}
}

variable "product_service_config" {
  description = "Configuration for Product Service"
  type        = map(string)
  default     = {}
}

variable "ai_workers_config" {
  description = "Configuration for AI Workers"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
