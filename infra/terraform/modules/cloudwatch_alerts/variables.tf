# CloudWatch Alerts Module Variables

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the Application Load Balancer"
  type        = string
}

variable "notification_email" {
  description = "Email address for notifications"
  type        = string
  default     = ""
}

variable "enable_budget_alerts" {
  description = "Enable AWS Budget alerts"
  type        = bool
  default     = true
}

variable "budget_limit_usd" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 300
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
