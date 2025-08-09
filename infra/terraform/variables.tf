# TikTok Commerce Link Hub - Variables
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "buylink"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway (cost optimization for dev)"
  type        = bool
  default     = false
}

# ECS Configuration
variable "enable_fargate_spot" {
  description = "Enable Fargate Spot capacity provider"
  type        = bool
  default     = true
}

# ALB Configuration
variable "enable_https" {
  description = "Enable HTTPS on ALB"
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# Cognito Configuration
variable "cognito_callback_urls" {
  description = "Cognito callback URLs"
  type        = list(string)
  default     = ["https://buylink.ug/auth/callback"]
}

variable "cognito_logout_urls" {
  description = "Cognito logout URLs"
  type        = list(string)
  default     = ["https://buylink.ug/auth/logout"]
}

# CORS Configuration
variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["https://buylink.ug", "https://www.buylink.ug", "https://admin.buylink.ug"]
}

# Application Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "buylink.ug"
}

variable "notification_email" {
  description = "Email for notifications and alerts"
  type        = string
  default     = "admin@buylink.ug"
}

# External Service Configuration
variable "apify_token" {
  description = "Apify API token for TikTok scraping"
  type        = string
  sensitive   = true
  default     = ""
}

variable "apify_actor_id" {
  description = "Apify actor ID for TikTok scraping"
  type        = string
  default     = "clockworks/tiktok-profile-scraper"
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for LLM services"
  type        = string
  sensitive   = true
  default     = ""
}

# Cost Control
variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 30
}

# Monitoring and Alerting
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

variable "budget_limit_usd" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 300
}

# ECS Service Configuration
variable "ingestion_api_config" {
  description = "Configuration for Ingestion API service"
  type = object({
    cpu                = number
    memory             = number
    min_capacity       = number
    max_capacity       = number
    target_cpu_percent = number
  })
  default = {
    cpu                = 512   # 0.5 vCPU
    memory             = 1024  # 1GB
    min_capacity       = 1
    max_capacity       = 10
    target_cpu_percent = 70
  }
}

variable "product_service_config" {
  description = "Configuration for Product Service"
  type = object({
    cpu                = number
    memory             = number
    min_capacity       = number
    max_capacity       = number
    target_cpu_percent = number
  })
  default = {
    cpu                = 512   # 0.5 vCPU
    memory             = 1024  # 1GB
    min_capacity       = 1
    max_capacity       = 5
    target_cpu_percent = 70
  }
}

variable "thumbnail_generator_config" {
  description = "Configuration for Thumbnail Generator worker"
  type = object({
    cpu          = number
    memory       = number
    min_capacity = number
    max_capacity = number
  })
  default = {
    cpu          = 1024  # 1 vCPU
    memory       = 2048  # 2GB
    min_capacity = 0
    max_capacity = 3
  }
}

variable "caption_parser_config" {
  description = "Configuration for Caption Parser worker"
  type = object({
    cpu          = number
    memory       = number
    min_capacity = number
    max_capacity = number
  })
  default = {
    cpu          = 256   # 0.25 vCPU
    memory       = 512   # 512MB
    min_capacity = 0
    max_capacity = 5
  }
}
