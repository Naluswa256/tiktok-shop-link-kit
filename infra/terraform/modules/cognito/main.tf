# Cognito Module

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = var.user_pool_name

  # Username configuration
  username_attributes = var.username_attributes
  alias_attributes    = var.alias_attributes

  username_configuration {
    case_sensitive = false
  }

  # Password policy
  password_policy {
    minimum_length                   = var.password_policy.minimum_length
    require_lowercase               = var.password_policy.require_lowercase
    require_numbers                 = var.password_policy.require_numbers
    require_symbols                 = var.password_policy.require_symbols
    require_uppercase               = var.password_policy.require_uppercase
    temporary_password_validity_days = var.password_policy.temporary_password_validity_days
  }

  # MFA configuration
  mfa_configuration = var.mfa_configuration

  # Account recovery
  account_recovery_setting {
    dynamic "recovery_mechanism" {
      for_each = var.recovery_mechanisms
      content {
        name     = recovery_mechanism.value.name
        priority = recovery_mechanism.value.priority
      }
    }
  }

  # Auto-verified attributes
  auto_verified_attributes = var.auto_verified_attributes

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = var.advanced_security_mode
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = var.device_configuration.challenge_required_on_new_device
    device_only_remembered_on_user_prompt = var.device_configuration.device_only_remembered_on_user_prompt
  }

  # Email configuration
  dynamic "email_configuration" {
    for_each = var.email_configuration != null ? [var.email_configuration] : []
    content {
      email_sending_account  = email_configuration.value.email_sending_account
      from_email_address    = email_configuration.value.from_email_address
      reply_to_email_address = email_configuration.value.reply_to_email_address
      source_arn            = email_configuration.value.source_arn
    }
  }

  # SMS configuration
  dynamic "sms_configuration" {
    for_each = var.sms_configuration != null ? [var.sms_configuration] : []
    content {
      external_id    = sms_configuration.value.external_id
      sns_caller_arn = sms_configuration.value.sns_caller_arn
    }
  }

  # User attribute update settings
  user_attribute_update_settings {
    attributes_require_verification_before_update = var.attributes_require_verification_before_update
  }

  # Verification message template
  verification_message_template {
    default_email_option  = var.verification_message_template.default_email_option
    email_message        = var.verification_message_template.email_message
    email_subject        = var.verification_message_template.email_subject
    sms_message          = var.verification_message_template.sms_message
  }

  # Lambda triggers
  dynamic "lambda_config" {
    for_each = length(var.lambda_triggers) > 0 ? [1] : []
    content {
      create_auth_challenge          = try(var.lambda_triggers.create_auth_challenge, null)
      custom_message                = try(var.lambda_triggers.custom_message, null)
      define_auth_challenge         = try(var.lambda_triggers.define_auth_challenge, null)
      post_authentication          = try(var.lambda_triggers.post_authentication, null)
      post_confirmation            = try(var.lambda_triggers.post_confirmation, null)
      pre_authentication           = try(var.lambda_triggers.pre_authentication, null)
      pre_sign_up                  = try(var.lambda_triggers.pre_sign_up, null)
      pre_token_generation         = try(var.lambda_triggers.pre_token_generation, null)
      user_migration               = try(var.lambda_triggers.user_migration, null)
      verify_auth_challenge_response = try(var.lambda_triggers.verify_auth_challenge_response, null)
    }
  }

  # Schema
  dynamic "schema" {
    for_each = var.schema
    content {
      attribute_data_type      = schema.value.attribute_data_type
      developer_only_attribute = try(schema.value.developer_only_attribute, false)
      mutable                 = try(schema.value.mutable, true)
      name                    = schema.value.name
      required                = try(schema.value.required, false)

      dynamic "number_attribute_constraints" {
        for_each = schema.value.attribute_data_type == "Number" && try(schema.value.number_attribute_constraints, null) != null ? [schema.value.number_attribute_constraints] : []
        content {
          max_value = try(number_attribute_constraints.value.max_value, null)
          min_value = try(number_attribute_constraints.value.min_value, null)
        }
      }

      dynamic "string_attribute_constraints" {
        for_each = schema.value.attribute_data_type == "String" && try(schema.value.string_attribute_constraints, null) != null ? [schema.value.string_attribute_constraints] : []
        content {
          max_length = try(string_attribute_constraints.value.max_length, null)
          min_length = try(string_attribute_constraints.value.min_length, null)
        }
      }
    }
  }

  tags = var.tags
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = var.client_name
  user_pool_id = aws_cognito_user_pool.main.id

  # Client configuration
  generate_secret                      = var.generate_client_secret
  prevent_user_existence_errors       = var.prevent_user_existence_errors
  enable_token_revocation             = var.enable_token_revocation
  enable_propagate_additional_user_context_data = var.enable_propagate_additional_user_context_data

  # Supported identity providers
  supported_identity_providers = var.supported_identity_providers

  # Callback and logout URLs
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  # OAuth configuration
  allowed_oauth_flows                  = var.allowed_oauth_flows
  allowed_oauth_flows_user_pool_client = var.allowed_oauth_flows_user_pool_client
  allowed_oauth_scopes                = var.allowed_oauth_scopes

  # Explicit auth flows
  explicit_auth_flows = var.explicit_auth_flows

  # Token validity
  access_token_validity  = var.access_token_validity
  id_token_validity     = var.id_token_validity
  refresh_token_validity = var.refresh_token_validity

  token_validity_units {
    access_token  = var.token_validity_units.access_token
    id_token      = var.token_validity_units.id_token
    refresh_token = var.token_validity_units.refresh_token
  }

  # Read and write attributes
  read_attributes  = var.read_attributes
  write_attributes = var.write_attributes
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  count = var.user_pool_domain != null ? 1 : 0

  domain       = var.user_pool_domain
  user_pool_id = aws_cognito_user_pool.main.id
}

# Cognito Identity Pool (if needed)
resource "aws_cognito_identity_pool" "main" {
  count = var.create_identity_pool ? 1 : 0

  identity_pool_name               = "${var.user_pool_name}-identity-pool"
  allow_unauthenticated_identities = var.allow_unauthenticated_identities

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = var.tags
}
