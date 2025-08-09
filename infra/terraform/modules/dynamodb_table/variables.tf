# DynamoDB Table Module Variables

variable "tables" {
  description = "Map of DynamoDB table configurations"
  type = map(object({
    name           = string
    billing_mode   = string
    hash_key       = string
    range_key      = optional(string)
    stream_enabled = optional(bool, false)
    read_capacity  = optional(number, 5)
    write_capacity = optional(number, 5)
    ttl_attribute  = optional(string)
    
    attributes = list(object({
      name = string
      type = string
    }))
    
    global_secondary_indexes = optional(list(object({
      name               = string
      hash_key           = string
      range_key          = optional(string)
      projection_type    = optional(string, "ALL")
      read_capacity      = optional(number, 5)
      write_capacity     = optional(number, 5)
    })), [])
    
    local_secondary_indexes = optional(list(object({
      name            = string
      range_key       = string
      projection_type = optional(string, "ALL")
    })), [])
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
  default     = null
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "enable_autoscaling" {
  description = "Enable auto scaling for PROVISIONED tables"
  type        = bool
  default     = true
}

variable "autoscaling_read_min_capacity" {
  description = "Minimum read capacity for auto scaling"
  type        = number
  default     = 5
}

variable "autoscaling_read_max_capacity" {
  description = "Maximum read capacity for auto scaling"
  type        = number
  default     = 100
}

variable "autoscaling_write_min_capacity" {
  description = "Minimum write capacity for auto scaling"
  type        = number
  default     = 5
}

variable "autoscaling_write_max_capacity" {
  description = "Maximum write capacity for auto scaling"
  type        = number
  default     = 100
}

variable "autoscaling_read_target_value" {
  description = "Target value for read capacity utilization"
  type        = number
  default     = 70.0
}

variable "autoscaling_write_target_value" {
  description = "Target value for write capacity utilization"
  type        = number
  default     = 70.0
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

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
