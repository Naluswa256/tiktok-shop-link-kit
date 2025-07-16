/**
 * SNS Topic Module for TikTok Commerce Link Hub
 * 
 * This module creates an SNS topic with appropriate permissions and configurations
 * optimized for AWS free tier usage.
 */

resource "aws_sns_topic" "this" {
  name = var.topic_name
  
  # Free tier optimization - disable content-based deduplication
  fifo_topic                  = false
  content_based_deduplication = false
  
  # Free tier optimization - use basic delivery policy
  delivery_policy = <<EOF
{
  "http": {
    "defaultHealthyRetryPolicy": {
      "minDelayTarget": 20,
      "maxDelayTarget": 20,
      "numRetries": 3,
      "numMaxDelayRetries": 0,
      "numNoDelayRetries": 0,
      "numMinDelayRetries": 0,
      "backoffFunction": "linear"
    },
    "disableSubscriptionOverrides": false,
    "defaultRequestPolicy": {
      "headerContentType": "text/plain; charset=UTF-8"
    }
  }
}
EOF

  # Apply tags
  tags = var.tags
}

# IAM policy for publishing to this topic
resource "aws_iam_policy" "sns_publish" {
  count = var.create_publish_policy ? 1 : 0
  
  name        = "publish-to-${var.topic_name}"
  description = "Policy for publishing to the ${var.topic_name} SNS topic"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = "sns:Publish"
        Effect   = "Allow"
        Resource = aws_sns_topic.this.arn
      }
    ]
  })
  
  tags = var.tags
}

# Optional CloudWatch alarm for monitoring
resource "aws_cloudwatch_metric_alarm" "sns_errors" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name          = "${var.topic_name}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "NumberOfNotificationsFailed"
  namespace           = "AWS/SNS"
  period              = 300
  statistic           = "Sum"
  threshold           = var.error_threshold
  alarm_description   = "This metric monitors failed notifications for ${var.topic_name}"
  
  dimensions = {
    TopicName = aws_sns_topic.this.name
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions
  
  tags = var.tags
}
