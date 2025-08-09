# Cognito Module Variables

variable "user_pool_name" {
  description = "Name of the Cognito User Pool"
  type        = string
}

variable "client_name" {
  description = "Name of the Cognito User Pool Client"
  type        = string
}

variable "user_pool_domain" {
  description = "Domain for the Cognito User Pool"
  type        = string
  default     = null
}

# User Pool Configuration
variable "username_attributes" {
  description = "Attributes used as username"
  type        = list(string)
  default     = ["email"]
}

variable "alias_attributes" {
  description = "Attributes supported as an alias for this user pool"
  type        = list(string)
  default     = ["email", "preferred_username"]
}

variable "auto_verified_attributes" {
  description = "Attributes to be auto-verified"
  type        = list(string)
  default     = ["email"]
}

variable "password_policy" {
  description = "Password policy configuration"
  type = object({
    minimum_length                   = number
    require_lowercase               = bool
    require_numbers                 = bool
    require_symbols                 = bool
    require_uppercase               = bool
    temporary_password_validity_days = number
  })
  default = {
    minimum_length                   = 8
    require_lowercase               = true
    require_numbers                 = true
    require_symbols                 = true
    require_uppercase               = true
    temporary_password_validity_days = 7
  }
}

variable "mfa_configuration" {
  description = "MFA configuration"
  type        = string
  default     = "OFF"
  validation {
    condition     = contains(["OFF", "ON", "OPTIONAL"], var.mfa_configuration)
    error_message = "MFA configuration must be OFF, ON, or OPTIONAL."
  }
}

variable "advanced_security_mode" {
  description = "Advanced security mode"
  type        = string
  default     = "OFF"
  validation {
    condition     = contains(["OFF", "AUDIT", "ENFORCED"], var.advanced_security_mode)
    error_message = "Advanced security mode must be OFF, AUDIT, or ENFORCED."
  }
}

variable "recovery_mechanisms" {
  description = "Account recovery mechanisms"
  type = list(object({
    name     = string
    priority = number
  }))
  default = [
    {
      name     = "verified_email"
      priority = 1
    }
  ]
}

variable "device_configuration" {
  description = "Device configuration"
  type = object({
    challenge_required_on_new_device      = bool
    device_only_remembered_on_user_prompt = bool
  })
  default = {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }
}

variable "email_configuration" {
  description = "Email configuration"
  type = object({
    email_sending_account  = string
    from_email_address    = optional(string)
    reply_to_email_address = optional(string)
    source_arn            = optional(string)
  })
  default = null
}

variable "sms_configuration" {
  description = "SMS configuration"
  type = object({
    external_id    = string
    sns_caller_arn = string
  })
  default = null
}

variable "attributes_require_verification_before_update" {
  description = "Attributes that require verification before update"
  type        = list(string)
  default     = ["email"]
}

variable "verification_message_template" {
  description = "Verification message template"
  type = object({
    default_email_option = string
    email_message        = optional(string)
    email_subject        = optional(string)
    sms_message          = optional(string)
  })
  default = {
    default_email_option = "CONFIRM_WITH_CODE"
    email_message        = "Your verification code is {####}"
    email_subject        = "Your verification code"
    sms_message          = "Your verification code is {####}"
  }
}

variable "lambda_triggers" {
  description = "Lambda triggers for Cognito events"
  type        = map(string)
  default     = {}
}

variable "schema" {
  description = "User pool schema"
  type = list(object({
    attribute_data_type      = string
    developer_only_attribute = optional(bool, false)
    mutable                 = optional(bool, true)
    name                    = string
    required                = optional(bool, false)
    
    number_attribute_constraints = optional(object({
      max_value = optional(string)
      min_value = optional(string)
    }))
    
    string_attribute_constraints = optional(object({
      max_length = optional(string)
      min_length = optional(string)
    }))
  }))
  default = []
}

# Client Configuration
variable "generate_client_secret" {
  description = "Generate client secret"
  type        = bool
  default     = false
}

variable "prevent_user_existence_errors" {
  description = "Prevent user existence errors"
  type        = string
  default     = "ENABLED"
}

variable "enable_token_revocation" {
  description = "Enable token revocation"
  type        = bool
  default     = true
}

variable "enable_propagate_additional_user_context_data" {
  description = "Enable propagate additional user context data"
  type        = bool
  default     = false
}

variable "supported_identity_providers" {
  description = "Supported identity providers"
  type        = list(string)
  default     = ["COGNITO"]
}

variable "callback_urls" {
  description = "Callback URLs"
  type        = list(string)
  default     = []
}

variable "logout_urls" {
  description = "Logout URLs"
  type        = list(string)
  default     = []
}

variable "allowed_oauth_flows" {
  description = "Allowed OAuth flows"
  type        = list(string)
  default     = ["code"]
}

variable "allowed_oauth_flows_user_pool_client" {
  description = "Allow OAuth flows for user pool client"
  type        = bool
  default     = true
}

variable "allowed_oauth_scopes" {
  description = "Allowed OAuth scopes"
  type        = list(string)
  default     = ["email", "openid", "profile"]
}

variable "explicit_auth_flows" {
  description = "Explicit authentication flows"
  type        = list(string)
  default     = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}

variable "access_token_validity" {
  description = "Access token validity"
  type        = number
  default     = 60
}

variable "id_token_validity" {
  description = "ID token validity"
  type        = number
  default     = 60
}

variable "refresh_token_validity" {
  description = "Refresh token validity"
  type        = number
  default     = 30
}

variable "token_validity_units" {
  description = "Token validity units"
  type = object({
    access_token  = string
    id_token      = string
    refresh_token = string
  })
  default = {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

variable "read_attributes" {
  description = "Read attributes"
  type        = list(string)
  default     = ["email", "email_verified", "preferred_username"]
}

variable "write_attributes" {
  description = "Write attributes"
  type        = list(string)
  default     = ["email", "preferred_username"]
}

# Identity Pool Configuration
variable "create_identity_pool" {
  description = "Create Cognito Identity Pool"
  type        = bool
  default     = false
}

variable "allow_unauthenticated_identities" {
  description = "Allow unauthenticated identities"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
