variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "versioning_enabled" {
  description = "Enable versioning for the bucket"
  type        = bool
  default     = false
}

variable "public_read_access" {
  description = "Enable public read access to the bucket"
  type        = bool
  default     = false
}

variable "cors_enabled" {
  description = "Enable CORS configuration"
  type        = bool
  default     = false
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"]
}

variable "lifecycle_enabled" {
  description = "Enable lifecycle configuration"
  type        = bool
  default     = false
}

variable "expiration_days" {
  description = "Number of days after which objects expire"
  type        = number
  default     = 0
}

variable "noncurrent_version_expiration_days" {
  description = "Number of days after which noncurrent versions expire"
  type        = number
  default     = 0
}

variable "transition_to_ia_days" {
  description = "Number of days after which objects transition to IA"
  type        = number
  default     = 0
}

variable "transition_to_glacier_days" {
  description = "Number of days after which objects transition to Glacier"
  type        = number
  default     = 0
}

variable "notification_enabled" {
  description = "Enable bucket notifications"
  type        = bool
  default     = false
}

variable "lambda_notifications" {
  description = "List of Lambda function notifications"
  type = list(object({
    function_arn  = string
    events        = list(string)
    filter_prefix = string
    filter_suffix = string
  }))
  default = []
}

variable "sns_notifications" {
  description = "List of SNS topic notifications"
  type = list(object({
    topic_arn     = string
    events        = list(string)
    filter_prefix = string
    filter_suffix = string
  }))
  default = []
}

variable "sqs_notifications" {
  description = "List of SQS queue notifications"
  type = list(object({
    queue_arn     = string
    events        = list(string)
    filter_prefix = string
    filter_suffix = string
  }))
  default = []
}

variable "tags" {
  description = "Tags to apply to the bucket"
  type        = map(string)
  default     = {}
}
