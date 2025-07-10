resource "aws_dynamodb_table" "this" {
  name           = var.table_name
  billing_mode   = var.billing_mode
  hash_key       = var.hash_key
  range_key      = var.range_key
  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null

  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "global_secondary_index" {
    for_each = var.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = global_secondary_index.value.range_key
      projection_type = global_secondary_index.value.projection_type
      
      read_capacity  = var.billing_mode == "PROVISIONED" ? global_secondary_index.value.read_capacity : null
      write_capacity = var.billing_mode == "PROVISIONED" ? global_secondary_index.value.write_capacity : null

      dynamic "non_key_attributes" {
        for_each = global_secondary_index.value.non_key_attributes != null ? [global_secondary_index.value.non_key_attributes] : []
        content {
          non_key_attributes = non_key_attributes.value
        }
      }
    }
  }

  dynamic "local_secondary_index" {
    for_each = var.local_secondary_indexes
    content {
      name            = local_secondary_index.value.name
      range_key       = local_secondary_index.value.range_key
      projection_type = local_secondary_index.value.projection_type

      dynamic "non_key_attributes" {
        for_each = local_secondary_index.value.non_key_attributes != null ? [local_secondary_index.value.non_key_attributes] : []
        content {
          non_key_attributes = non_key_attributes.value
        }
      }
    }
  }

  dynamic "ttl" {
    for_each = var.ttl_enabled ? [1] : []
    content {
      attribute_name = var.ttl_attribute_name
      enabled        = true
    }
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery_enabled
  }

  server_side_encryption {
    enabled     = var.server_side_encryption_enabled
    kms_key_id  = var.kms_key_id
  }

  stream_enabled   = var.stream_enabled
  stream_view_type = var.stream_enabled ? var.stream_view_type : null

  tags = var.tags

  lifecycle {
    ignore_changes = [
      read_capacity,
      write_capacity,
    ]
  }
}

# Auto Scaling for the table
resource "aws_appautoscaling_target" "read_target" {
  count              = var.billing_mode == "PROVISIONED" && var.autoscaling_enabled ? 1 : 0
  max_capacity       = var.autoscaling_read_max_capacity
  min_capacity       = var.autoscaling_read_min_capacity
  resource_id        = "table/${aws_dynamodb_table.this.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "read_policy" {
  count              = var.billing_mode == "PROVISIONED" && var.autoscaling_enabled ? 1 : 0
  name               = "${var.table_name}-read-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = var.autoscaling_read_target_value
  }
}

resource "aws_appautoscaling_target" "write_target" {
  count              = var.billing_mode == "PROVISIONED" && var.autoscaling_enabled ? 1 : 0
  max_capacity       = var.autoscaling_write_max_capacity
  min_capacity       = var.autoscaling_write_min_capacity
  resource_id        = "table/${aws_dynamodb_table.this.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "write_policy" {
  count              = var.billing_mode == "PROVISIONED" && var.autoscaling_enabled ? 1 : 0
  name               = "${var.table_name}-write-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.write_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.write_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.write_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = var.autoscaling_write_target_value
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "read_throttled_requests" {
  count               = var.cloudwatch_alarms_enabled ? 1 : 0
  alarm_name          = "${var.table_name}-read-throttled-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors read throttled requests"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = aws_dynamodb_table.this.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "write_throttled_requests" {
  count               = var.cloudwatch_alarms_enabled ? 1 : 0
  alarm_name          = "${var.table_name}-write-throttled-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors write throttled requests"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = aws_dynamodb_table.this.name
  }

  tags = var.tags
}
