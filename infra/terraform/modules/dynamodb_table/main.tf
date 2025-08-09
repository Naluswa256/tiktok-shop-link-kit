# DynamoDB Table Module

# DynamoDB Tables
resource "aws_dynamodb_table" "tables" {
  for_each = var.tables

  name           = each.value.name
  billing_mode   = each.value.billing_mode
  hash_key       = each.value.hash_key
  range_key      = each.value.range_key
  stream_enabled = each.value.stream_enabled

  # Read/Write capacity (only for PROVISIONED billing mode)
  read_capacity  = each.value.billing_mode == "PROVISIONED" ? try(each.value.read_capacity, 5) : null
  write_capacity = each.value.billing_mode == "PROVISIONED" ? try(each.value.write_capacity, 5) : null

  # Attributes
  dynamic "attribute" {
    for_each = each.value.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # Global Secondary Indexes
  dynamic "global_secondary_index" {
    for_each = each.value.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = try(global_secondary_index.value.range_key, null)
      projection_type = try(global_secondary_index.value.projection_type, "ALL")
      
      # Capacity for PROVISIONED billing mode
      read_capacity  = each.value.billing_mode == "PROVISIONED" ? try(global_secondary_index.value.read_capacity, 5) : null
      write_capacity = each.value.billing_mode == "PROVISIONED" ? try(global_secondary_index.value.write_capacity, 5) : null
    }
  }

  # Local Secondary Indexes
  dynamic "local_secondary_index" {
    for_each = try(each.value.local_secondary_indexes, [])
    content {
      name            = local_secondary_index.value.name
      range_key       = local_secondary_index.value.range_key
      projection_type = try(local_secondary_index.value.projection_type, "ALL")
    }
  }

  # TTL
  dynamic "ttl" {
    for_each = try(each.value.ttl_attribute, null) != null ? [1] : []
    content {
      attribute_name = each.value.ttl_attribute
      enabled        = true
    }
  }

  # Server-side encryption
  dynamic "server_side_encryption" {
    for_each = var.enable_encryption ? [1] : []
    content {
      enabled = true
    }
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Deletion protection
  deletion_protection_enabled = var.enable_deletion_protection

  tags = merge(var.tags, {
    Name = each.value.name
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Auto Scaling for PROVISIONED tables
resource "aws_appautoscaling_target" "read_target" {
  for_each = {
    for k, v in var.tables : k => v
    if v.billing_mode == "PROVISIONED" && var.enable_autoscaling
  }

  max_capacity       = var.autoscaling_read_max_capacity
  min_capacity       = var.autoscaling_read_min_capacity
  resource_id        = "table/${aws_dynamodb_table.tables[each.key].name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_target" "write_target" {
  for_each = {
    for k, v in var.tables : k => v
    if v.billing_mode == "PROVISIONED" && var.enable_autoscaling
  }

  max_capacity       = var.autoscaling_write_max_capacity
  min_capacity       = var.autoscaling_write_min_capacity
  resource_id        = "table/${aws_dynamodb_table.tables[each.key].name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

# Auto Scaling Policies
resource "aws_appautoscaling_policy" "read_policy" {
  for_each = {
    for k, v in var.tables : k => v
    if v.billing_mode == "PROVISIONED" && var.enable_autoscaling
  }

  name               = "${aws_dynamodb_table.tables[each.key].name}-read-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.read_target[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.read_target[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.read_target[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = var.autoscaling_read_target_value
  }
}

resource "aws_appautoscaling_policy" "write_policy" {
  for_each = {
    for k, v in var.tables : k => v
    if v.billing_mode == "PROVISIONED" && var.enable_autoscaling
  }

  name               = "${aws_dynamodb_table.tables[each.key].name}-write-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.write_target[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.write_target[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.write_target[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = var.autoscaling_write_target_value
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "read_throttled_requests" {
  for_each = var.enable_monitoring ? var.tables : {}

  alarm_name          = "${aws_dynamodb_table.tables[each.key].name}-read-throttled-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB read throttled requests"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = aws_dynamodb_table.tables[each.key].name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "write_throttled_requests" {
  for_each = var.enable_monitoring ? var.tables : {}

  alarm_name          = "${aws_dynamodb_table.tables[each.key].name}-write-throttled-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB write throttled requests"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = aws_dynamodb_table.tables[each.key].name
  }

  tags = var.tags
}
