# SQS Queue Module Variables

variable "queues" {
  description = "Map of SQS queue configurations"
  type = map(object({
    name                       = string
    dlq_name                   = string
    visibility_timeout_seconds = number
    message_retention_seconds  = number
    max_receive_count          = number
    max_message_size          = optional(number, 262144)
    delay_seconds             = optional(number, 0)
    receive_wait_time_seconds = optional(number, 20)
  }))
}

variable "sns_subscriptions" {
  description = "Map of SNS topic subscriptions"
  type = map(object({
    topic_arn     = string
    queue_name    = string
    filter_policy = optional(string)
  }))
  default = {}
}

variable "enable_encryption" {
  description = "Enable server-side encryption"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (uses AWS managed key if not specified)"
  type        = string
  default     = "alias/aws/sqs"
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

variable "queue_depth_threshold" {
  description = "Threshold for queue depth alarm"
  type        = number
  default     = 50
}

variable "message_age_threshold" {
  description = "Threshold for message age alarm (seconds)"
  type        = number
  default     = 1800 # 30 minutes
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
