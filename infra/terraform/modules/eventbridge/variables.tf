# EventBridge Module Variables

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
}

# Schedule Configuration
variable "morning_schedule_expression" {
  description = "Schedule expression for morning ingestion"
  type        = string
  default     = "cron(0 6 * * ? *)" # 6:00 AM UTC daily
}

variable "evening_schedule_expression" {
  description = "Schedule expression for evening ingestion"
  type        = string
  default     = "cron(0 18 * * ? *)" # 6:00 PM UTC daily
}

# Lambda Configuration
variable "create_lambda_function" {
  description = "Create Lambda function for scheduled ingestion"
  type        = bool
  default     = true
}

variable "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  type        = string
  default     = ""
}

variable "lambda_image_uri" {
  description = "URI of the Lambda container image"
  type        = string
  default     = ""
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_environment_variables" {
  description = "Environment variables for Lambda function"
  type        = map(string)
  default     = {}
}

variable "lambda_vpc_config" {
  description = "VPC configuration for Lambda function"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

variable "lambda_dlq_arn" {
  description = "ARN of the dead letter queue for Lambda"
  type        = string
  default     = null
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for Lambda"
  type        = bool
  default     = true
}

# ECS Scheduled Task Configuration (Alternative to Lambda)
variable "create_ecs_scheduled_task" {
  description = "Create ECS scheduled task instead of Lambda"
  type        = bool
  default     = false
}

variable "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  type        = string
  default     = ""
}

variable "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  type        = string
  default     = ""
}

variable "ecs_subnet_ids" {
  description = "List of subnet IDs for ECS tasks"
  type        = list(string)
  default     = []
}

variable "ecs_security_group_ids" {
  description = "List of security group IDs for ECS tasks"
  type        = list(string)
  default     = []
}

variable "ecs_events_role_arn" {
  description = "ARN of the IAM role for EventBridge to invoke ECS tasks"
  type        = string
  default     = ""
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of alarm actions (SNS topic ARNs)"
  type        = list(string)
  default     = []
}

variable "lambda_duration_threshold" {
  description = "Threshold for Lambda duration alarm (milliseconds)"
  type        = number
  default     = 240000 # 4 minutes
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
