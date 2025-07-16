/**
 * SQS Queue Module for TikTok Commerce Link Hub
 * 
 * This module creates an SQS queue with optional dead letter queue (DLQ)
 * optimized for AWS free tier usage.
 */

# Main SQS Queue
resource "aws_sqs_queue" "this" {
  name = var.queue_name
  
  # Free tier optimization - shorter retention period
  message_retention_seconds = var.message_retention_seconds
  
  # Visibility timeout should be longer than Lambda timeout
  visibility_timeout_seconds = var.visibility_timeout_seconds
  
  # Free tier optimization - no encryption by default
  kms_master_key_id = var.kms_master_key_id
  
  # Receive wait time for long polling (reduces API calls)
  receive_wait_time_seconds = var.receive_wait_time_seconds
  
  # Maximum message size (256 KB is free tier limit)
  max_message_size = var.max_message_size
  
  # Dead letter queue configuration
  redrive_policy = var.dead_letter_queue_enabled ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null
  
  # Apply tags
  tags = var.tags
}

# Dead Letter Queue (optional)
resource "aws_sqs_queue" "dlq" {
  count = var.dead_letter_queue_enabled ? 1 : 0
  
  name = "${var.queue_name}-dlq"
  
  # DLQ should have longer retention for debugging
  message_retention_seconds = var.dlq_message_retention_seconds
  
  # Apply tags
  tags = merge(var.tags, {
    Type = "DeadLetterQueue"
  })
}

# IAM policy for consuming from this queue
resource "aws_iam_policy" "sqs_consume" {
  count = var.create_consume_policy ? 1 : 0
  
  name        = "consume-from-${var.queue_name}"
  description = "Policy for consuming from the ${var.queue_name} SQS queue"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Effect   = "Allow"
        Resource = aws_sqs_queue.this.arn
      }
    ]
  })
  
  tags = var.tags
}

# IAM policy for sending to this queue
resource "aws_iam_policy" "sqs_send" {
  count = var.create_send_policy ? 1 : 0
  
  name        = "send-to-${var.queue_name}"
  description = "Policy for sending to the ${var.queue_name} SQS queue"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Effect   = "Allow"
        Resource = aws_sqs_queue.this.arn
      }
    ]
  })
  
  tags = var.tags
}

# CloudWatch alarms for monitoring (optional)
resource "aws_cloudwatch_metric_alarm" "queue_depth" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name          = "${var.queue_name}-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = var.queue_depth_threshold
  alarm_description   = "This metric monitors queue depth for ${var.queue_name}"
  
  dimensions = {
    QueueName = aws_sqs_queue.this.name
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions
  
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  count = var.dead_letter_queue_enabled && var.create_alarms ? 1 : 0
  
  alarm_name          = "${var.queue_name}-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "This metric monitors messages in DLQ for ${var.queue_name}"
  
  dimensions = {
    QueueName = aws_sqs_queue.dlq[0].name
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions
  
  tags = var.tags
}
