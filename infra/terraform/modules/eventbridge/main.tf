# EventBridge Module

# EventBridge Rules for Scheduled Ingestion
resource "aws_cloudwatch_event_rule" "scheduled_ingestion_morning" {
  name                = "${var.name_prefix}-scheduled-ingestion-morning"
  description         = "Trigger scheduled ingestion at 6:00 AM UTC daily"
  schedule_expression = var.morning_schedule_expression

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-scheduled-ingestion-morning"
    Type = "ScheduledIngestion"
  })
}

resource "aws_cloudwatch_event_rule" "scheduled_ingestion_evening" {
  name                = "${var.name_prefix}-scheduled-ingestion-evening"
  description         = "Trigger scheduled ingestion at 6:00 PM UTC daily"
  schedule_expression = var.evening_schedule_expression

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-scheduled-ingestion-evening"
    Type = "ScheduledIngestion"
  })
}

# Lambda Function for Scheduled Ingestion
resource "aws_lambda_function" "scheduled_ingestion" {
  count = var.create_lambda_function ? 1 : 0

  function_name = "${var.name_prefix}-scheduled-ingestion"
  role         = var.lambda_execution_role_arn
  
  # Container image configuration
  package_type = "Image"
  image_uri    = var.lambda_image_uri
  
  # Function configuration
  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size
  
  # Environment variables
  environment {
    variables = var.lambda_environment_variables
  }

  # VPC configuration (if needed)
  dynamic "vpc_config" {
    for_each = var.lambda_vpc_config != null ? [var.lambda_vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  # Dead letter queue configuration
  dynamic "dead_letter_config" {
    for_each = var.lambda_dlq_arn != null ? [1] : []
    content {
      target_arn = var.lambda_dlq_arn
    }
  }

  # Tracing configuration
  tracing_config {
    mode = var.enable_xray_tracing ? "Active" : "PassThrough"
  }

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.lambda
  ]
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  count = var.create_lambda_function ? 1 : 0

  name              = "/aws/lambda/${var.name_prefix}-scheduled-ingestion"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-scheduled-ingestion-logs"
  })
}

# EventBridge Targets for Lambda
resource "aws_cloudwatch_event_target" "lambda_morning" {
  count = var.create_lambda_function ? 1 : 0

  rule      = aws_cloudwatch_event_rule.scheduled_ingestion_morning.name
  target_id = "ScheduledIngestionMorningTarget"
  arn       = aws_lambda_function.scheduled_ingestion[0].arn

  input = jsonencode({
    schedule = "morning"
    time     = "06:00"
  })
}

resource "aws_cloudwatch_event_target" "lambda_evening" {
  count = var.create_lambda_function ? 1 : 0

  rule      = aws_cloudwatch_event_rule.scheduled_ingestion_evening.name
  target_id = "ScheduledIngestionEveningTarget"
  arn       = aws_lambda_function.scheduled_ingestion[0].arn

  input = jsonencode({
    schedule = "evening"
    time     = "18:00"
  })
}

# Lambda Permissions for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_morning" {
  count = var.create_lambda_function ? 1 : 0

  statement_id  = "AllowExecutionFromEventBridgeMorning"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduled_ingestion[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled_ingestion_morning.arn
}

resource "aws_lambda_permission" "allow_eventbridge_evening" {
  count = var.create_lambda_function ? 1 : 0

  statement_id  = "AllowExecutionFromEventBridgeEvening"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduled_ingestion[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled_ingestion_evening.arn
}

# Alternative: ECS Scheduled Tasks (if not using Lambda)
resource "aws_cloudwatch_event_target" "ecs_morning" {
  count = var.create_ecs_scheduled_task ? 1 : 0

  rule      = aws_cloudwatch_event_rule.scheduled_ingestion_morning.name
  target_id = "ScheduledIngestionECSMorningTarget"
  arn       = var.ecs_cluster_arn

  ecs_target {
    task_definition_arn = var.ecs_task_definition_arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.ecs_subnet_ids
      security_groups  = var.ecs_security_group_ids
      assign_public_ip = false
    }
  }

  role_arn = var.ecs_events_role_arn

  input = jsonencode({
    schedule = "morning"
    time     = "06:00"
  })
}

resource "aws_cloudwatch_event_target" "ecs_evening" {
  count = var.create_ecs_scheduled_task ? 1 : 0

  rule      = aws_cloudwatch_event_rule.scheduled_ingestion_evening.name
  target_id = "ScheduledIngestionECSEveningTarget"
  arn       = var.ecs_cluster_arn

  ecs_target {
    task_definition_arn = var.ecs_task_definition_arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.ecs_subnet_ids
      security_groups  = var.ecs_security_group_ids
      assign_public_ip = false
    }
  }

  role_arn = var.ecs_events_role_arn

  input = jsonencode({
    schedule = "evening"
    time     = "18:00"
  })
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.create_lambda_function && var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-scheduled-ingestion-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Lambda function errors"
  alarm_actions       = var.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.scheduled_ingestion[0].function_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  count = var.create_lambda_function && var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-scheduled-ingestion-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = var.lambda_duration_threshold
  alarm_description   = "This metric monitors Lambda function duration"
  alarm_actions       = var.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.scheduled_ingestion[0].function_name
  }

  tags = var.tags
}
