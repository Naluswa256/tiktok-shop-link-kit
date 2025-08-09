# SNS Topic Module Variables

variable "topics" {
  description = "Map of SNS topic configurations"
  type = map(object({
    name         = string
    display_name = optional(string)
  }))
}

variable "enable_encryption" {
  description = "Enable server-side encryption"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (uses AWS managed key if not specified)"
  type        = string
  default     = "alias/aws/sns"
}

variable "delivery_policy" {
  description = "SNS delivery policy"
  type        = string
  default     = null
}

variable "allowed_services" {
  description = "List of AWS services allowed to publish to topics"
  type        = list(string)
  default = [
    "events.amazonaws.com",
    "lambda.amazonaws.com",
    "ecs-tasks.amazonaws.com"
  ]
}

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

variable "high_message_threshold" {
  description = "Threshold for high message volume alarm"
  type        = number
  default     = 1000
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
