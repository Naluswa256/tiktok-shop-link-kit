# ECS Service Module

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "service" {
  name              = "/ecs/${var.service_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.service_name}-logs"
  })
}

# ECS Task Definition
resource "aws_ecs_task_definition" "service" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn           = var.task_role_arn

  container_definitions = jsonencode([
    {
      name  = var.service_name
      image = var.container_image
      
      # Port mappings
      portMappings = var.port_mappings
      
      # Environment variables
      environment = [
        for k, v in var.environment_variables : {
          name  = k
          value = tostring(v)
        }
      ]
      
      # Secrets from Parameter Store/Secrets Manager
      secrets = [
        for k, v in var.secrets : {
          name      = k
          valueFrom = v
        }
      ]
      
      # Logging
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
      
      # Health check
      healthCheck = var.health_check != null ? {
        command     = var.health_check.command
        interval    = var.health_check.interval
        timeout     = var.health_check.timeout
        retries     = var.health_check.retries
        startPeriod = var.health_check.start_period
      } : null
      
      # Resource requirements
      essential = true
      
      # Linux parameters
      linuxParameters = var.enable_execute_command ? {
        initProcessEnabled = true
      } : null
    }
  ])

  # Runtime platform
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  tags = var.tags
}

# ECS Service
resource "aws_ecs_service" "service" {
  name            = var.service_name
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.service.arn
  desired_count   = var.desired_count
  launch_type     = var.launch_type

  # Capacity provider strategy (for Fargate Spot)
  dynamic "capacity_provider_strategy" {
    for_each = var.capacity_provider_strategy
    content {
      capacity_provider = capacity_provider_strategy.value.capacity_provider
      weight           = capacity_provider_strategy.value.weight
      base             = capacity_provider_strategy.value.base
    }
  }

  # Network configuration
  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = var.assign_public_ip
  }

  # Load balancer configuration
  dynamic "load_balancer" {
    for_each = var.target_group_arn != null ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.service_name
      container_port   = var.container_port
    }
  }

  # Service discovery
  dynamic "service_registries" {
    for_each = var.service_discovery_registry_arn != null ? [1] : []
    content {
      registry_arn = var.service_discovery_registry_arn
    }
  }

  # Deployment configuration
  dynamic "deployment_configuration" {
    for_each = [1]
    content {
      maximum_percent         = var.deployment_maximum_percent
      minimum_healthy_percent = var.deployment_minimum_healthy_percent

      deployment_circuit_breaker {
        enable   = var.enable_deployment_circuit_breaker
        rollback = var.enable_deployment_rollback
      }
    }
  }

  # Enable execute command for debugging
  enable_execute_command = var.enable_execute_command

  # Health check grace period
  health_check_grace_period_seconds = var.target_group_arn != null ? var.health_check_grace_period : null

  # Propagate tags
  propagate_tags = "SERVICE"

  # Wait for steady state
  wait_for_steady_state = var.wait_for_steady_state

  tags = var.tags

  depends_on = [
    aws_ecs_task_definition.service
  ]

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Auto Scaling Target
resource "aws_appautoscaling_target" "service" {
  count = var.enable_autoscaling ? 1 : 0

  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = var.tags
}

# Auto Scaling Policy - CPU
resource "aws_appautoscaling_policy" "cpu" {
  count = var.enable_autoscaling && var.cpu_target_value != null ? 1 : 0

  name               = "${var.service_name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# Auto Scaling Policy - Memory
resource "aws_appautoscaling_policy" "memory" {
  count = var.enable_autoscaling && var.memory_target_value != null ? 1 : 0

  name               = "${var.service_name}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.memory_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# Auto Scaling Policy - SQS Queue Depth (for workers)
resource "aws_appautoscaling_policy" "sqs" {
  count = var.enable_autoscaling && var.sqs_queue_name != null ? 1 : 0

  name               = "${var.service_name}-sqs-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ApproximateNumberOfVisibleMessages"
      namespace   = "AWS/SQS"
      statistic   = "Average"

      dynamic "dimensions" {
        for_each = [1]
        content {
          name  = "QueueName"
          value = var.sqs_queue_name
        }
      }
    }
    target_value       = var.sqs_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.service_name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ServiceName = aws_ecs_service.service.name
    ClusterName = var.cluster_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.service_name}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ServiceName = aws_ecs_service.service.name
    ClusterName = var.cluster_name
  }

  tags = var.tags
}

# Data sources
data "aws_region" "current" {}
