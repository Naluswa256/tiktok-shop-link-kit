# S3 Bucket Module Outputs

output "bucket_names" {
  description = "Names of the S3 buckets"
  value       = { for k, v in aws_s3_bucket.buckets : k => v.id }
}

output "bucket_arns" {
  description = "ARNs of the S3 buckets"
  value       = { for k, v in aws_s3_bucket.buckets : k => v.arn }
}

output "bucket_domain_names" {
  description = "Domain names of the S3 buckets"
  value       = { for k, v in aws_s3_bucket.buckets : k => v.bucket_domain_name }
}

output "bucket_regional_domain_names" {
  description = "Regional domain names of the S3 buckets"
  value       = { for k, v in aws_s3_bucket.buckets : k => v.bucket_regional_domain_name }
}

output "bucket_hosted_zone_ids" {
  description = "Hosted zone IDs of the S3 buckets"
  value       = { for k, v in aws_s3_bucket.buckets : k => v.hosted_zone_id }
}
