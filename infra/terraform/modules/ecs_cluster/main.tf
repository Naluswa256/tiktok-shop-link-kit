# ECS Cluster Module

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = var.name

  # Enable container insights for monitoring
  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = var.tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = local.capacity_providers

  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_fargate_capacity_providers ? [1] : []
    content {
      capacity_provider = "FARGATE"
      weight            = var.enable_fargate_spot ? 1 : 2
      base              = 1
    }
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 2
      base              = 0
    }
  }
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.name}-ecs-logs"
  })
}

# Local values
locals {
  capacity_providers = concat(
    var.enable_fargate_capacity_providers ? ["FARGATE"] : [],
    var.enable_fargate_spot ? ["FARGATE_SPOT"] : [],
    var.enable_ec2_capacity_providers ? ["EC2"] : []
  )
}
