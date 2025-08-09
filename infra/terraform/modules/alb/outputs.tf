# ALB Module Outputs

output "arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

output "dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "arn_suffix" {
  description = "ARN suffix of the load balancer"
  value       = aws_lb.main.arn_suffix
}

output "target_group_arns" {
  description = "ARNs of target groups"
  value = {
    ingestion_api   = aws_lb_target_group.ingestion_api.arn
    product_service = aws_lb_target_group.product_service.arn
  }
}

output "listener_arns" {
  description = "ARNs of listeners"
  value = {
    http  = aws_lb_listener.http.arn
    https = var.enable_https ? aws_lb_listener.https[0].arn : null
  }
}
