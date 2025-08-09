# SNS Topic Module

# SNS Topics
resource "aws_sns_topic" "topics" {
  for_each = var.topics

  name         = each.value.name
  display_name = try(each.value.display_name, each.value.name)

  # Encryption
  kms_master_key_id = var.enable_encryption ? var.kms_key_id : null

  # Delivery policy
  delivery_policy = var.delivery_policy

  tags = merge(var.tags, {
    Name = each.value.name
  })
}

# SNS Topic Policies
resource "aws_sns_topic_policy" "topics" {
  for_each = var.topics

  arn = aws_sns_topic.topics[each.key].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "${each.value.name}-policy"
    Statement = [
      {
        Sid    = "AllowPublishFromServices"
        Effect = "Allow"
        Principal = {
          Service = var.allowed_services
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.topics[each.key].arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowSubscribeFromSameAccount"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "SNS:Subscribe",
          "SNS:Receive"
        ]
        Resource = aws_sns_topic.topics[each.key].arn
      }
    ]
  })
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "failed_notifications" {
  for_each = var.enable_monitoring ? var.topics : {}

  alarm_name          = "${aws_sns_topic.topics[each.key].name}-failed-notifications"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NumberOfNotificationsFailed"
  namespace           = "AWS/SNS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors SNS failed notifications"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TopicName = aws_sns_topic.topics[each.key].name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "messages_published" {
  for_each = var.enable_monitoring ? var.topics : {}

  alarm_name          = "${aws_sns_topic.topics[each.key].name}-high-message-volume"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NumberOfMessagesPublished"
  namespace           = "AWS/SNS"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.high_message_threshold
  alarm_description   = "This metric monitors SNS high message volume"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TopicName = aws_sns_topic.topics[each.key].name
  }

  tags = var.tags
}

# Data sources
data "aws_caller_identity" "current" {}
