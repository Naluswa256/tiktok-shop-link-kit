# Secrets Manager Module Variables

variable "name_prefix" {
  description = "Name prefix for secrets"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = "alias/aws/secretsmanager"
}

variable "recovery_window_in_days" {
  description = "Recovery window in days for deleted secrets"
  type        = number
  default     = 7
}

# Cross-region replication
variable "enable_cross_region_replica" {
  description = "Enable cross-region replication"
  type        = bool
  default     = false
}

variable "replica_regions" {
  description = "List of regions for secret replication"
  type        = list(string)
  default     = []
}

variable "replica_kms_key_id" {
  description = "KMS key ID for replica regions"
  type        = string
  default     = "alias/aws/secretsmanager"
}

# Custom secrets
variable "secrets" {
  description = "Map of custom secrets"
  type = map(object({
    description = string
    value       = any
    type        = optional(string, "string") # "string" or "json"
  }))
  default   = {}
  sensitive = true
}

# Database configuration (for future RDS integration)
variable "create_database_secret" {
  description = "Create database secret"
  type        = bool
  default     = false
}

variable "database_username" {
  description = "Database username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "database_password" {
  description = "Database password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "database_engine" {
  description = "Database engine"
  type        = string
  default     = "postgres"
}

variable "database_host" {
  description = "Database host"
  type        = string
  default     = ""
}

variable "database_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = ""
}

# JWT secrets
variable "jwt_secret" {
  description = "JWT secret (will be generated if not provided)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_admin_secret" {
  description = "JWT admin secret (will be generated if not provided)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "admin_password_hash" {
  description = "Admin password hash"
  type        = string
  default     = ""
  sensitive   = true
}

# External API secrets
variable "apify_token" {
  description = "Apify API token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "openrouter_api_key" {
  description = "OpenRouter API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  default     = ""
  sensitive   = true
}

# Cognito configuration
variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "cognito_client_id" {
  description = "Cognito Client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cognito_client_secret" {
  description = "Cognito Client Secret"
  type        = string
  default     = ""
  sensitive   = true
}

# Admin configuration
variable "admin_username" {
  description = "Admin username"
  type        = string
  default     = "admin@buylink.ug"
}

variable "admin_refresh_cookie_name" {
  description = "Admin refresh cookie name"
  type        = string
  default     = "admin_refresh_token"
}

# Secret rotation
variable "enable_secret_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = false
}

variable "rotation_lambda_arn" {
  description = "ARN of the Lambda function for secret rotation"
  type        = string
  default     = ""
}

variable "rotation_days" {
  description = "Number of days between automatic rotations"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
