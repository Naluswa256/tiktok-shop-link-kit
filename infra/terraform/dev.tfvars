# Environment Configuration
project_name = "tiktok-commerce"
environment  = "dev"
aws_region   = "us-east-1"

# CORS Configuration
cors_origins = [
  "http://localhost:8080",
  "https://localhost:8080",
  "http://localhost:3000",
  "https://localhost:3000"
]

# Database Configuration
dynamodb_billing_mode = "PAY_PER_REQUEST"
enable_point_in_time_recovery = false

# Networking Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]

# ECS Configuration
enable_container_insights = true

# Auto Scaling Configuration
min_capacity = 1
max_capacity = 3
target_cpu_utilization = 70
target_memory_utilization = 80

# Lambda Configuration
lambda_timeout = 300
lambda_memory_size = 512

# Monitoring Configuration
enable_detailed_monitoring = true
log_retention_days = 7

# Security Configuration
enable_waf = false
allowed_ip_ranges = ["0.0.0.0/0"]

# Backup Configuration
backup_retention_days = 7

# Cost Optimization
enable_spot_instances = true
schedule_scaling = false

# Feature Flags
enable_xray_tracing = true
enable_api_caching = false
cache_ttl_seconds = 300

# Notification Configuration
notification_email = "dev-team@example.com"

# Additional Tags
additional_tags = {
  Owner       = "Development Team"
  CostCenter  = "Engineering"
  Backup      = "Required"
  Monitoring  = "Enhanced"
}
