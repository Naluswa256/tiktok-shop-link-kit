# CloudWatch Alerts Module Outputs

output "alerts_topic_arn" {
  description = "ARN of the alerts SNS topic"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "budget_name" {
  description = "Name of the budget"
  value       = var.enable_budget_alerts ? aws_budgets_budget.monthly[0].name : null
}

# Data sources
data "aws_region" "current" {}
