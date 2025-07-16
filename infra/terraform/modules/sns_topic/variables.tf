variable "topic_name" {
  description = "Name of the SNS topic"
  type        = string
}

variable "create_publish_policy" {
  description = "Whether to create an IAM policy for publishing to this topic"
  type        = bool
  default     = true
}

variable "create_alarms" {
  description = "Whether to create CloudWatch alarms for monitoring"
  type        = bool
  default     = false
}

variable "error_threshold" {
  description = "Threshold for error alarm"
  type        = number
  default     = 5
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
