# ECS Service Module Variables

variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "cluster_id" {
  description = "ID of the ECS cluster"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "container_image" {
  description = "Container image URI"
  type        = string
}

variable "cpu" {
  description = "CPU units for the task"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory for the task (MB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "launch_type" {
  description = "Launch type for the service"
  type        = string
  default     = "FARGATE"
}

variable "cpu_architecture" {
  description = "CPU architecture"
  type        = string
  default     = "X86_64"
}

# Network Configuration
variable "subnet_ids" {
  description = "List of subnet IDs"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Assign public IP to tasks"
  type        = bool
  default     = false
}

# IAM Roles
variable "execution_role_arn" {
  description = "ARN of the task execution role"
  type        = string
}

variable "task_role_arn" {
  description = "ARN of the task role"
  type        = string
}

# Container Configuration
variable "port_mappings" {
  description = "Port mappings for the container"
  type = list(object({
    containerPort = number
    hostPort      = optional(number)
    protocol      = optional(string, "tcp")
  }))
  default = []
}

variable "container_port" {
  description = "Container port for load balancer"
  type        = number
  default     = 80
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets for the container (Parameter Store/Secrets Manager)"
  type        = map(string)
  default     = {}
}

# Health Check
variable "health_check" {
  description = "Health check configuration"
  type = object({
    command      = list(string)
    interval     = optional(number, 30)
    timeout      = optional(number, 5)
    retries      = optional(number, 3)
    start_period = optional(number, 60)
  })
  default = null
}

variable "health_check_grace_period" {
  description = "Health check grace period for load balancer"
  type        = number
  default     = 300
}

# Load Balancer
variable "target_group_arn" {
  description = "ARN of the target group"
  type        = string
  default     = null
}

# Service Discovery
variable "service_discovery_registry_arn" {
  description = "ARN of the service discovery registry"
  type        = string
  default     = null
}

# Capacity Provider Strategy
variable "capacity_provider_strategy" {
  description = "Capacity provider strategy"
  type = list(object({
    capacity_provider = string
    weight           = number
    base             = optional(number, 0)
  }))
  default = []
}

# Deployment Configuration
variable "deployment_maximum_percent" {
  description = "Maximum percent of tasks during deployment"
  type        = number
  default     = 200
}

variable "deployment_minimum_healthy_percent" {
  description = "Minimum healthy percent during deployment"
  type        = number
  default     = 100
}

variable "enable_deployment_circuit_breaker" {
  description = "Enable deployment circuit breaker"
  type        = bool
  default     = true
}

variable "enable_deployment_rollback" {
  description = "Enable deployment rollback"
  type        = bool
  default     = true
}

variable "enable_execute_command" {
  description = "Enable execute command for debugging"
  type        = bool
  default     = false
}

variable "wait_for_steady_state" {
  description = "Wait for service to reach steady state"
  type        = bool
  default     = false
}

# Auto Scaling
variable "enable_autoscaling" {
  description = "Enable auto scaling"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "cpu_target_value" {
  description = "Target CPU utilization for auto scaling"
  type        = number
  default     = null
}

variable "memory_target_value" {
  description = "Target memory utilization for auto scaling"
  type        = number
  default     = null
}

variable "sqs_queue_name" {
  description = "SQS queue name for scaling (workers only)"
  type        = string
  default     = null
}

variable "sqs_target_value" {
  description = "Target SQS queue depth for auto scaling"
  type        = number
  default     = 10
}

variable "scale_in_cooldown" {
  description = "Scale in cooldown period (seconds)"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Scale out cooldown period (seconds)"
  type        = number
  default     = 300
}

# Monitoring
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

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
