variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "tiktok-commerce"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "localhost"
}

variable "notification_email" {
  description = "Email address for notifications"
  type        = string
  default     = ""
}

variable "apify_token" {
  description = "Apify API token for TikTok scraping"
  type        = string
  sensitive   = true
  default     = ""
}

variable "apify_actor_id" {
  description = "Apify actor ID for TikTok profile scraper"
  type        = string
  default     = "clockworks/tiktok-profile-scraper"
}

variable "cors_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = [
    "http://localhost:3000",
    "http://localhost:8080",
    "https://localhost:3000",
    "https://localhost:8080"
  ]
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB"
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for DynamoDB"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 7
}
