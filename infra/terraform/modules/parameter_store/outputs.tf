# Parameter Store Module Outputs

output "parameter_arns" {
  description = "ARNs of all parameters"
  value = merge(
    { for k, v in aws_ssm_parameter.standard : k => v.arn },
    { for k, v in aws_ssm_parameter.secure : k => v.arn },
    { for k, v in aws_ssm_parameter.app_config : k => v.arn },
    { for k, v in aws_ssm_parameter.environment : k => v.arn }
  )
}

output "parameter_names" {
  description = "Names of all parameters"
  value = merge(
    { for k, v in aws_ssm_parameter.standard : k => v.name },
    { for k, v in aws_ssm_parameter.secure : k => v.name },
    { for k, v in aws_ssm_parameter.app_config : k => v.name },
    { for k, v in aws_ssm_parameter.environment : k => v.name }
  )
}

output "config_parameter_names" {
  description = "Names of configuration parameters"
  value       = { for k, v in aws_ssm_parameter.app_config : k => v.name }
}

output "service_parameter_names" {
  description = "Names of service-specific parameters (managed via ECS environment variables)"
  value       = {}
}

output "parameter_hierarchy" {
  description = "Parameter hierarchy information"
  value = {
    config_path   = "/${var.name_prefix}/config/"
    env_path      = "/${var.name_prefix}/env/"
    services_path = "/${var.name_prefix}/services/"
    aws_path      = "/${var.name_prefix}/aws/"
  }
}
