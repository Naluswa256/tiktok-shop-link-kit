# Operational Runbooks

This document provides step-by-step procedures for common operational tasks, incident response, and maintenance activities for the TikTok Commerce Link Hub.

## 📋 Table of Contents

- [Daily Operations](#daily-operations)
- [Incident Response](#incident-response)
- [Maintenance Procedures](#maintenance-procedures)
- [Scaling Operations](#scaling-operations)
- [Backup & Recovery](#backup--recovery)
- [Security Procedures](#security-procedures)
- [Performance Optimization](#performance-optimization)
- [Emergency Procedures](#emergency-procedures)

## 📅 Daily Operations

### Morning Health Check
**Frequency**: Daily at 9:00 AM
**Duration**: 15 minutes
**Responsible**: On-call engineer

#### Checklist
```bash
# 1. Check overall system health
curl https://api.tiktokcommerce.com/health
curl https://products.tiktokcommerce.com/health

# 2. Verify CloudWatch alarms
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query 'MetricAlarms[?StateValue==`ALARM`].[AlarmName,StateReason]'

# 3. Check ECS service status
aws ecs describe-services \
  --cluster production-cluster \
  --services ingestion-api product-service

# 4. Verify Lambda function health
aws lambda list-functions \
  --query 'Functions[?State!=`Active`].[FunctionName,State]'

# 5. Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# 6. Review error rates
aws logs filter-log-events \
  --log-group-name /ecs/tiktok-commerce-ingestion-api \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern 'ERROR'
```

#### Expected Results
- All health endpoints return 200 OK
- No active CloudWatch alarms
- All ECS services running with desired count
- All Lambda functions in Active state
- DynamoDB read/write capacity within limits
- Error rate < 1%

### Log Review
**Frequency**: Daily at 2:00 PM
**Duration**: 30 minutes

```bash
# Review application logs for patterns
aws logs insights start-query \
  --log-group-name /ecs/tiktok-commerce-ingestion-api \
  --start-time $(date -d '24 hours ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100'

# Check for unusual traffic patterns
aws logs insights start-query \
  --log-group-name /aws/apigateway/tiktok-commerce \
  --start-time $(date -d '24 hours ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, requestId, status | filter status >= 400 | stats count() by status'
```

## 🚨 Incident Response

### Severity Levels

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P0** | Service completely down | 15 minutes | API returning 5xx, database unavailable |
| **P1** | Major functionality impacted | 1 hour | High error rates, slow response times |
| **P2** | Minor functionality impacted | 4 hours | Single feature broken, non-critical errors |
| **P3** | Cosmetic or enhancement | 24 hours | UI issues, documentation updates |

### P0 Incident Response

#### 1. Initial Assessment (0-5 minutes)
```bash
# Check service status
curl -I https://api.tiktokcommerce.com/health

# Check CloudWatch dashboard
aws cloudwatch get-dashboard \
  --dashboard-name TikTokCommerce-Production

# Verify DNS resolution
nslookup api.tiktokcommerce.com
```

#### 2. Immediate Actions (5-15 minutes)
```bash
# Check ECS service health
aws ecs describe-services \
  --cluster production-cluster \
  --services ingestion-api product-service

# Review recent deployments
aws ecs describe-task-definition \
  --task-definition tiktok-commerce-ingestion-api \
  --query 'taskDefinition.revision'

# Check load balancer health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/tiktok-commerce-ingestion/1234567890123456
```

#### 3. Escalation Procedures
```bash
# If service restart doesn't resolve:
# 1. Page on-call architect
# 2. Create incident in PagerDuty
# 3. Start incident bridge
# 4. Notify stakeholders via Slack

# Emergency rollback
aws ecs update-service \
  --cluster production-cluster \
  --service ingestion-api \
  --task-definition tiktok-commerce-ingestion-api:PREVIOUS_REVISION
```

### Common Incident Scenarios

#### High Error Rate (5xx errors > 5%)
```bash
# 1. Check application logs
aws logs tail /ecs/tiktok-commerce-ingestion-api --follow

# 2. Check database connectivity
aws dynamodb describe-table --table-name tiktok-commerce-videos-prod

# 3. Verify external dependencies
curl -I https://api.openai.com/v1/models
curl -I https://graph.facebook.com/v18.0/me

# 4. Scale up if needed
aws ecs update-service \
  --cluster production-cluster \
  --service ingestion-api \
  --desired-count 4
```

#### Database Performance Issues
```bash
# 1. Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=tiktok-commerce-products-prod

# 2. Review slow queries
aws logs insights start-query \
  --log-group-name /ecs/tiktok-commerce-product-service \
  --query-string 'fields @timestamp, @message | filter @message like /DynamoDB/ and @message like /slow/ | sort @timestamp desc'

# 3. Increase read/write capacity if needed
aws dynamodb update-table \
  --table-name tiktok-commerce-products-prod \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100
```

## 🔧 Maintenance Procedures

### Weekly Maintenance
**Schedule**: Sundays 2:00 AM UTC
**Duration**: 2 hours
**Maintenance Window**: Low traffic period

#### Pre-maintenance Checklist
```bash
# 1. Verify backup completion
aws dynamodb list-backups \
  --table-name tiktok-commerce-products-prod \
  --time-range-lower-bound $(date -d '24 hours ago' +%s)

# 2. Check system health
npm run health:check:all

# 3. Notify stakeholders
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-type: application/json' \
  -d '{"text":"🔧 Starting weekly maintenance window"}'
```

#### Maintenance Tasks
```bash
# 1. Update container images
aws ecs update-service \
  --cluster production-cluster \
  --service ingestion-api \
  --force-new-deployment

# 2. Clean up old Lambda versions
aws lambda list-versions-by-function \
  --function-name tiktok-commerce-caption-parser \
  --query 'Versions[?Version!=`$LATEST`].Version' \
  --output text | xargs -I {} aws lambda delete-function \
  --function-name tiktok-commerce-caption-parser \
  --qualifier {}

# 3. Rotate secrets
aws secretsmanager rotate-secret \
  --secret-id tiktok-commerce/api-keys

# 4. Clean up old logs
aws logs delete-log-group \
  --log-group-name /ecs/old-service-logs

# 5. Update security groups
terraform plan -var-file=production.tfvars
terraform apply -auto-approve
```

#### Post-maintenance Verification
```bash
# 1. Health check all services
curl https://api.tiktokcommerce.com/health
curl https://products.tiktokcommerce.com/health

# 2. Run smoke tests
npm run test:smoke:production

# 3. Verify metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)

# 4. Notify completion
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-type: application/json' \
  -d '{"text":"✅ Weekly maintenance completed successfully"}'
```

### Monthly Security Updates
**Schedule**: First Saturday of each month
**Duration**: 4 hours

```bash
# 1. Update base images
docker pull node:18-alpine
docker pull python:3.11-alpine
docker pull redis:7-alpine

# 2. Rebuild all images
npm run docker:build:all

# 3. Security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image tiktok-commerce-ingestion-api:latest

# 4. Update dependencies
npm audit fix
pip-audit --fix

# 5. Deploy updates
terraform plan -var-file=production.tfvars
terraform apply
```

## 📈 Scaling Operations

### Auto Scaling Triggers

#### Scale Up Conditions
- CPU utilization > 70% for 5 minutes
- Memory utilization > 80% for 5 minutes
- SQS queue depth > 100 messages
- Response time > 2 seconds

#### Scale Down Conditions
- CPU utilization < 30% for 15 minutes
- Memory utilization < 50% for 15 minutes
- SQS queue depth < 10 messages
- Response time < 500ms

### Manual Scaling

#### Scale ECS Services
```bash
# Scale up ingestion API
aws ecs update-service \
  --cluster production-cluster \
  --service ingestion-api \
  --desired-count 5

# Scale up product service
aws ecs update-service \
  --cluster production-cluster \
  --service product-service \
  --desired-count 3

# Verify scaling
aws ecs describe-services \
  --cluster production-cluster \
  --services ingestion-api product-service \
  --query 'services[*].[serviceName,runningCount,desiredCount]'
```

#### Scale Lambda Concurrency
```bash
# Increase reserved concurrency
aws lambda put-reserved-concurrency-config \
  --function-name tiktok-commerce-caption-parser \
  --reserved-concurrency-config ReservedConcurrencyConfig=100

# Monitor invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=tiktok-commerce-caption-parser
```

#### Scale Database
```bash
# Increase DynamoDB capacity
aws dynamodb update-table \
  --table-name tiktok-commerce-products-prod \
  --provisioned-throughput ReadCapacityUnits=200,WriteCapacityUnits=100

# Scale ElastiCache
aws elasticache modify-replication-group \
  --replication-group-id tiktok-commerce-redis \
  --cache-node-type cache.r6g.large
```

## 💾 Backup & Recovery

### Daily Backup Procedures
**Schedule**: 3:00 AM UTC daily
**Retention**: 30 days

```bash
# 1. DynamoDB backup
aws dynamodb create-backup \
  --table-name tiktok-commerce-products-prod \
  --backup-name daily-backup-$(date +%Y%m%d)

# 2. S3 backup verification
aws s3api head-bucket-versioning \
  --bucket tiktok-commerce-assets-prod

# 3. Configuration backup
aws s3 cp terraform.tfstate s3://tiktok-commerce-backups/terraform/$(date +%Y%m%d)/

# 4. Database export
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:123456789012:table/tiktok-commerce-products-prod \
  --s3-bucket tiktok-commerce-exports \
  --s3-prefix daily-export-$(date +%Y%m%d)
```

### Disaster Recovery

#### RTO/RPO Targets
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour

#### Recovery Procedures
```bash
# 1. Assess damage scope
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteTable

# 2. Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name tiktok-commerce-products-prod-restored \
  --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/products/backup/01234567890123-abcdefgh

# 3. Update application configuration
terraform apply -var="products_table_name=tiktok-commerce-products-prod-restored"

# 4. Verify data integrity
npm run test:data-integrity

# 5. Switch traffic
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://failover-change.json
```

## 🔒 Security Procedures

### Security Incident Response
```bash
# 1. Isolate affected resources
aws ec2 modify-security-group-rules \
  --group-id sg-12345678 \
  --security-group-rules GroupId=sg-12345678,SecurityGroupRuleId=sgr-12345678,SecurityGroupRule='{IpPermissions=[{IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]}]}'

# 2. Review access logs
aws logs filter-log-events \
  --log-group-name /aws/apigateway/tiktok-commerce \
  --filter-pattern '[timestamp, request_id, ip = "SUSPICIOUS_IP", ...]'

# 3. Rotate compromised credentials
aws secretsmanager rotate-secret \
  --secret-id tiktok-commerce/api-keys \
  --force-rotate-immediately

# 4. Update WAF rules
aws wafv2 update-web-acl \
  --scope CLOUDFRONT \
  --id 12345678-1234-1234-1234-123456789012 \
  --default-action Allow={} \
  --rules file://updated-waf-rules.json
```

### Access Review
**Frequency**: Monthly
```bash
# 1. Review IAM users and roles
aws iam list-users --query 'Users[*].[UserName,CreateDate]'
aws iam list-roles --query 'Roles[?contains(RoleName, `tiktok-commerce`)].[RoleName,CreateDate]'

# 2. Check unused access keys
aws iam get-access-key-last-used --access-key-id AKIAIOSFODNN7EXAMPLE

# 3. Review security groups
aws ec2 describe-security-groups \
  --query 'SecurityGroups[?IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`]]].[GroupId,GroupName]'

# 4. Audit CloudTrail logs
aws logs insights start-query \
  --log-group-name CloudTrail/TikTokCommerce \
  --start-time $(date -d '30 days ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, sourceIPAddress, userIdentity.type | filter sourceIPAddress not like /^10\./ | stats count() by sourceIPAddress'
```

---

**Next**: [Architecture Documentation](../architecture/system-architecture.md)
