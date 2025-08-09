# DynamoDB Table Module Outputs

output "table_names" {
  description = "Names of the DynamoDB tables"
  value       = { for k, v in aws_dynamodb_table.tables : k => v.name }
}

output "table_arns" {
  description = "ARNs of the DynamoDB tables"
  value       = { for k, v in aws_dynamodb_table.tables : k => v.arn }
}

output "table_ids" {
  description = "IDs of the DynamoDB tables"
  value       = { for k, v in aws_dynamodb_table.tables : k => v.id }
}

output "table_stream_arns" {
  description = "Stream ARNs of the DynamoDB tables"
  value       = { for k, v in aws_dynamodb_table.tables : k => v.stream_arn if v.stream_enabled }
}

output "table_stream_labels" {
  description = "Stream labels of the DynamoDB tables"
  value       = { for k, v in aws_dynamodb_table.tables : k => v.stream_label if v.stream_enabled }
}
