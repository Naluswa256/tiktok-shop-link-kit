variable "table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "billing_mode" {
  description = "Billing mode for the table (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "hash_key" {
  description = "Hash key (partition key) for the table"
  type        = string
}

variable "range_key" {
  description = "Range key (sort key) for the table"
  type        = string
  default     = null
}

variable "read_capacity" {
  description = "Read capacity units (only used with PROVISIONED billing mode)"
  type        = number
  default     = 5
}

variable "write_capacity" {
  description = "Write capacity units (only used with PROVISIONED billing mode)"
  type        = number
  default     = 5
}

variable "attributes" {
  description = "List of attributes for the table"
  type = list(object({
    name = string
    type = string
  }))
  default = []
}

variable "global_secondary_indexes" {
  description = "List of global secondary indexes"
  type = list(object({
    name               = string
    hash_key           = string
    range_key          = optional(string)
    projection_type    = string
    non_key_attributes = optional(list(string))
    read_capacity      = optional(number)
    write_capacity     = optional(number)
  }))
  default = []
}

variable "local_secondary_indexes" {
  description = "List of local secondary indexes"
  type = list(object({
    name               = string
    range_key          = string
    projection_type    = string
    non_key_attributes = optional(list(string))
  }))
  default = []
}

variable "ttl_enabled" {
  description = "Whether TTL is enabled"
  type        = bool
  default     = false
}

variable "ttl_attribute_name" {
  description = "Name of the TTL attribute"
  type        = string
  default     = "ttl"
}

variable "point_in_time_recovery_enabled" {
  description = "Whether point-in-time recovery is enabled"
  type        = bool
  default     = false
}

variable "server_side_encryption_enabled" {
  description = "Whether server-side encryption is enabled"
  type        = bool
  default     = true
}

variable "server_side_encryption_kms_key_id" {
  description = "KMS key ID for server-side encryption"
  type        = string
  default     = null
}

variable "stream_enabled" {
  description = "Whether DynamoDB streams are enabled"
  type        = bool
  default     = false
}

variable "stream_view_type" {
  description = "Stream view type"
  type        = string
  default     = "NEW_AND_OLD_IMAGES"
}

variable "deletion_protection_enabled" {
  description = "Whether deletion protection is enabled"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to the table"
  type        = map(string)
  default     = {}
}
