# S3 Bucket Module

# S3 Buckets
resource "aws_s3_bucket" "buckets" {
  for_each = var.buckets

  bucket        = each.value.name
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Name = each.value.name
  })
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "buckets" {
  for_each = var.buckets

  bucket = aws_s3_bucket.buckets[each.key].id
  versioning_configuration {
    status = try(each.value.versioning, false) ? "Enabled" : "Suspended"
  }
}

# S3 Bucket Server-side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "buckets" {
  for_each = var.buckets

  bucket = aws_s3_bucket.buckets[each.key].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.encryption_algorithm
      kms_master_key_id = var.encryption_algorithm == "aws:kms" ? var.kms_key_id : null
    }
    bucket_key_enabled = var.encryption_algorithm == "aws:kms" ? true : null
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "buckets" {
  for_each = var.buckets

  bucket = aws_s3_bucket.buckets[each.key].id

  block_public_acls       = var.block_public_access
  block_public_policy     = var.block_public_access
  ignore_public_acls      = var.block_public_access
  restrict_public_buckets = var.block_public_access
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "buckets" {
  for_each = {
    for k, v in var.buckets : k => v
    if try(length(v.lifecycle_rules), 0) > 0
  }

  bucket = aws_s3_bucket.buckets[each.key].id

  dynamic "rule" {
    for_each = each.value.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.status

      # Expiration
      dynamic "expiration" {
        for_each = try(rule.value.expiration, null) != null ? [rule.value.expiration] : []
        content {
          days = expiration.value.days
        }
      }

      # Transitions
      dynamic "transition" {
        for_each = try(rule.value.transitions, [])
        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }

      # Non-current version expiration
      dynamic "noncurrent_version_expiration" {
        for_each = try(rule.value.noncurrent_version_expiration, null) != null ? [rule.value.noncurrent_version_expiration] : []
        content {
          noncurrent_days = noncurrent_version_expiration.value.days
        }
      }

      # Non-current version transitions
      dynamic "noncurrent_version_transition" {
        for_each = try(rule.value.noncurrent_version_transitions, [])
        content {
          noncurrent_days = noncurrent_version_transition.value.days
          storage_class   = noncurrent_version_transition.value.storage_class
        }
      }

      # Abort incomplete multipart uploads
      dynamic "abort_incomplete_multipart_upload" {
        for_each = try(rule.value.abort_incomplete_multipart_upload_days, null) != null ? [1] : []
        content {
          days_after_initiation = rule.value.abort_incomplete_multipart_upload_days
        }
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.buckets]
}

# S3 Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "buckets" {
  for_each = {
    for k, v in var.buckets : k => v
    if try(length(v.cors_rules), 0) > 0
  }

  bucket = aws_s3_bucket.buckets[each.key].id

  dynamic "cors_rule" {
    for_each = each.value.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = try(cors_rule.value.expose_headers, [])
      max_age_seconds = try(cors_rule.value.max_age_seconds, 3000)
    }
  }
}

# S3 Bucket Notification Configuration
resource "aws_s3_bucket_notification" "buckets" {
  for_each = {
    for k, v in var.buckets : k => v
    if try(length(v.notifications), 0) > 0
  }

  bucket = aws_s3_bucket.buckets[each.key].id

  dynamic "topic" {
    for_each = try(each.value.notifications.sns, [])
    content {
      topic_arn     = topic.value.topic_arn
      events        = topic.value.events
      filter_prefix = try(topic.value.filter_prefix, "")
      filter_suffix = try(topic.value.filter_suffix, "")
    }
  }

  dynamic "queue" {
    for_each = try(each.value.notifications.sqs, [])
    content {
      queue_arn     = queue.value.queue_arn
      events        = queue.value.events
      filter_prefix = try(queue.value.filter_prefix, "")
      filter_suffix = try(queue.value.filter_suffix, "")
    }
  }

  dynamic "lambda_function" {
    for_each = try(each.value.notifications.lambda, [])
    content {
      lambda_function_arn = lambda_function.value.function_arn
      events              = lambda_function.value.events
      filter_prefix       = try(lambda_function.value.filter_prefix, "")
      filter_suffix       = try(lambda_function.value.filter_suffix, "")
    }
  }
}

# S3 Bucket Intelligent Tiering Configuration
resource "aws_s3_bucket_intelligent_tiering_configuration" "buckets" {
  for_each = {
    for k, v in var.buckets : k => v
    if try(v.enable_intelligent_tiering, false)
  }

  bucket = aws_s3_bucket.buckets[each.key].id
  name   = "EntireBucket"

  status = "Enabled"

  # Archive configurations
  dynamic "tiering" {
    for_each = var.intelligent_tiering_archive_configurations
    content {
      access_tier = tiering.value.access_tier
      days        = tiering.value.days
    }
  }
}

# CloudWatch Metrics for monitoring
resource "aws_cloudwatch_metric_alarm" "bucket_size" {
  for_each = var.enable_monitoring ? var.buckets : {}

  alarm_name          = "${aws_s3_bucket.buckets[each.key].id}-bucket-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400" # 24 hours
  statistic           = "Average"
  threshold           = var.bucket_size_threshold
  alarm_description   = "This metric monitors S3 bucket size"
  alarm_actions       = var.alarm_actions

  dimensions = {
    BucketName  = aws_s3_bucket.buckets[each.key].id
    StorageType = "StandardStorage"
  }

  tags = var.tags
}
