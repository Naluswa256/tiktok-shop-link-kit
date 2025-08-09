# SQS Queue Module

# Dead Letter Queues
resource "aws_sqs_queue" "dlq" {
  for_each = var.queues

  name = each.value.dlq_name

  # Encryption
  kms_master_key_id                 = var.enable_encryption ? var.kms_key_id : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  # Message retention
  message_retention_seconds = 1209600 # 14 days

  tags = merge(var.tags, {
    Name = each.value.dlq_name
    Type = "DeadLetterQueue"
  })
}

# Main Queues
resource "aws_sqs_queue" "queues" {
  for_each = var.queues

  name = each.value.name

  # Encryption
  kms_master_key_id                 = var.enable_encryption ? var.kms_key_id : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  # Queue configuration
  visibility_timeout_seconds = each.value.visibility_timeout_seconds
  message_retention_seconds  = each.value.message_retention_seconds
  max_message_size          = try(each.value.max_message_size, 262144)
  delay_seconds             = try(each.value.delay_seconds, 0)
  receive_wait_time_seconds = try(each.value.receive_wait_time_seconds, 20)

  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = each.value.max_receive_count
  })

  # Redrive allow policy for DLQ
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.dlq[each.key].arn]
  })

  tags = merge(var.tags, {
    Name = each.value.name
    Type = "MainQueue"
  })
}

# Queue Policies
resource "aws_sqs_queue_policy" "queues" {
  for_each = var.queues

  queue_url = aws_sqs_queue.queues[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "${each.value.name}-policy"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.queues[each.key].arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowECSTasksAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.queues[each.key].arn
      }
    ]
  })
}

# SNS Subscriptions
resource "aws_sns_topic_subscription" "sqs" {
  for_each = var.sns_subscriptions

  topic_arn = each.value.topic_arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.queues[each.value.queue_name].arn

  # Filter policy if provided
  filter_policy = try(each.value.filter_policy, null)

  depends_on = [aws_sqs_queue_policy.queues]
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "queue_depth" {
  for_each = var.enable_monitoring ? var.queues : {}

  alarm_name          = "${aws_sqs_queue.queues[each.key].name}-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.queue_depth_threshold
  alarm_description   = "This metric monitors SQS queue depth"
  alarm_actions       = var.alarm_actions

  dimensions = {
    QueueName = aws_sqs_queue.queues[each.key].name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  for_each = var.enable_monitoring ? var.queues : {}

  alarm_name          = "${aws_sqs_queue.dlq[each.key].name}-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors DLQ messages"
  alarm_actions       = var.alarm_actions

  dimensions = {
    QueueName = aws_sqs_queue.dlq[each.key].name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "message_age" {
  for_each = var.enable_monitoring ? var.queues : {}

  alarm_name          = "${aws_sqs_queue.queues[each.key].name}-message-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Maximum"
  threshold           = var.message_age_threshold
  alarm_description   = "This metric monitors SQS message age"
  alarm_actions       = var.alarm_actions

  dimensions = {
    QueueName = aws_sqs_queue.queues[each.key].name
  }

  tags = var.tags
}

# Data sources
data "aws_caller_identity" "current" {}
