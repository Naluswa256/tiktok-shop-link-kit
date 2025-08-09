# S3 Bucket Module Variables

variable "buckets" {
  description = "Map of S3 bucket configurations"
  type = map(object({
    name                        = string
    versioning                 = optional(bool, false)
    enable_intelligent_tiering  = optional(bool, false)
    
    lifecycle_rules = optional(list(object({
      id     = string
      status = string
      
      expiration = optional(object({
        days = number
      }))
      
      transitions = optional(list(object({
        days          = number
        storage_class = string
      })), [])
      
      noncurrent_version_expiration = optional(object({
        days = number
      }))
      
      noncurrent_version_transitions = optional(list(object({
        days          = number
        storage_class = string
      })), [])
      
      abort_incomplete_multipart_upload_days = optional(number)
    })), [])
    
    cors_rules = optional(list(object({
      allowed_headers = list(string)
      allowed_methods = list(string)
      allowed_origins = list(string)
      expose_headers  = optional(list(string), [])
      max_age_seconds = optional(number, 3000)
    })), [])
    
    notifications = optional(object({
      sns = optional(list(object({
        topic_arn     = string
        events        = list(string)
        filter_prefix = optional(string, "")
        filter_suffix = optional(string, "")
      })), [])
      
      sqs = optional(list(object({
        queue_arn     = string
        events        = list(string)
        filter_prefix = optional(string, "")
        filter_suffix = optional(string, "")
      })), [])
      
      lambda = optional(list(object({
        function_arn  = string
        events        = list(string)
        filter_prefix = optional(string, "")
        filter_suffix = optional(string, "")
      })), [])
    }))
  }))
}

variable "force_destroy" {
  description = "Allow bucket to be destroyed even if it contains objects"
  type        = bool
  default     = false
}

variable "block_public_access" {
  description = "Block all public access to buckets"
  type        = bool
  default     = true
}

variable "encryption_algorithm" {
  description = "Server-side encryption algorithm"
  type        = string
  default     = "AES256"
  validation {
    condition     = contains(["AES256", "aws:kms"], var.encryption_algorithm)
    error_message = "Encryption algorithm must be either AES256 or aws:kms."
  }
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (only used if encryption_algorithm is aws:kms)"
  type        = string
  default     = null
}

variable "intelligent_tiering_archive_configurations" {
  description = "Intelligent tiering archive configurations"
  type = list(object({
    access_tier = string
    days        = number
  }))
  default = [
    {
      access_tier = "DEEP_ARCHIVE_ACCESS"
      days        = 180
    }
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

variable "bucket_size_threshold" {
  description = "Threshold for bucket size alarm (bytes)"
  type        = number
  default     = 107374182400 # 100GB
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
