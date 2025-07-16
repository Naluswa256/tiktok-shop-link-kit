variable "queue_name" {
  description = "Name of the SQS queue"
  type        = string
}

variable "visibility_timeout_seconds" {
  description = "Visibility timeout for the queue in seconds"
  type        = number
  default     = 30
}

variable "message_retention_seconds" {
  description = "Message retention period in seconds (max 14 days)"
  type        = number
  default     = 345600 # 4 days (free tier optimization)
}

variable "max_message_size" {
  description = "Maximum message size in bytes (max 256 KB)"
  type        = number
  default     = 262144 # 256 KB
}

variable "receive_wait_time_seconds" {
  description = "Time for which a ReceiveMessage call will wait for a message to arrive"
  type        = number
  default     = 20 # Long polling to reduce API calls
}

variable "kms_master_key_id" {
  description = "KMS key ID for encryption (leave empty for no encryption)"
  type        = string
  default     = null
}

variable "dead_letter_queue_enabled" {
  description = "Whether to create a dead letter queue"
  type        = bool
  default     = true
}

variable "max_receive_count" {
  description = "Maximum number of receives before message is sent to DLQ"
  type        = number
  default     = 3
}

variable "dlq_message_retention_seconds" {
  description = "Message retention period for DLQ in seconds"
  type        = number
  default     = 1209600 # 14 days
}

variable "create_consume_policy" {
  description = "Whether to create an IAM policy for consuming from this queue"
  type        = bool
  default     = true
}

variable "create_send_policy" {
  description = "Whether to create an IAM policy for sending to this queue"
  type        = bool
  default     = true
}

variable "create_alarms" {
  description = "Whether to create CloudWatch alarms for monitoring"
  type        = bool
  default     = false
}

variable "queue_depth_threshold" {
  description = "Threshold for queue depth alarm"
  type        = number
  default     = 100
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarm triggers"
  type        = list(string)
  default     = []
}

variable "ok_actions" {
  description = "List of ARNs to notify when alarm clears"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
