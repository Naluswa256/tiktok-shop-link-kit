#!/bin/bash

# AI Workers Monitoring Script
# Monitors production AI workers and provides real-time status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
ENVIRONMENT=${ENVIRONMENT:-"prod"}
PROJECT_NAME="tiktok-commerce"

echo -e "${BLUE}📊 TikTok Commerce AI Workers Monitor${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Load environment if available
if [ -f "apps/ingestion-api/.env.local" ]; then
    source apps/ingestion-api/.env.local
fi

# Function to get queue metrics
get_queue_metrics() {
    local queue_url=$1
    local queue_name=$2
    
    if [ -z "$queue_url" ]; then
        echo -e "${RED}❌ $queue_name: Queue URL not configured${NC}"
        return
    fi
    
    local metrics=$(aws sqs get-queue-attributes \
        --queue-url "$queue_url" \
        --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible \
        --region "$AWS_REGION" \
        --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local visible=$(echo "$metrics" | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
        local processing=$(echo "$metrics" | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // "0"')
        
        if [ "$visible" -eq 0 ] && [ "$processing" -eq 0 ]; then
            echo -e "${GREEN}✅ $queue_name: Empty (${visible} pending, ${processing} processing)${NC}"
        elif [ "$visible" -gt 10 ]; then
            echo -e "${RED}⚠️  $queue_name: High load (${visible} pending, ${processing} processing)${NC}"
        else
            echo -e "${YELLOW}📬 $queue_name: Active (${visible} pending, ${processing} processing)${NC}"
        fi
    else
        echo -e "${RED}❌ $queue_name: Cannot access queue${NC}"
    fi
}

# Function to get Lambda function status
get_lambda_status() {
    local function_name=$1
    local display_name=$2
    
    local status=$(aws lambda get-function \
        --function-name "$function_name" \
        --region "$AWS_REGION" \
        --query 'Configuration.State' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        case "$status" in
            "Active")
                echo -e "${GREEN}✅ $display_name: Active${NC}"
                ;;
            "Pending")
                echo -e "${YELLOW}⏳ $display_name: Pending${NC}"
                ;;
            "Failed")
                echo -e "${RED}❌ $display_name: Failed${NC}"
                ;;
            *)
                echo -e "${YELLOW}❓ $display_name: $status${NC}"
                ;;
        esac
    else
        echo -e "${RED}❌ $display_name: Cannot access function${NC}"
    fi
}

# Function to get ECS service status
get_ecs_status() {
    local cluster_name="$PROJECT_NAME-$ENVIRONMENT"
    local service_name="thumbnail-generator"
    
    local status=$(aws ecs describe-services \
        --cluster "$cluster_name" \
        --services "$service_name" \
        --region "$AWS_REGION" \
        --query 'services[0].status' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$status" != "None" ]; then
        local running=$(aws ecs describe-services \
            --cluster "$cluster_name" \
            --services "$service_name" \
            --region "$AWS_REGION" \
            --query 'services[0].runningCount' \
            --output text 2>/dev/null)
        
        local desired=$(aws ecs describe-services \
            --cluster "$cluster_name" \
            --services "$service_name" \
            --region "$AWS_REGION" \
            --query 'services[0].desiredCount' \
            --output text 2>/dev/null)
        
        if [ "$running" -eq "$desired" ] && [ "$running" -gt 0 ]; then
            echo -e "${GREEN}✅ Thumbnail Generator: Running ($running/$desired tasks)${NC}"
        elif [ "$running" -lt "$desired" ]; then
            echo -e "${YELLOW}⚠️  Thumbnail Generator: Scaling ($running/$desired tasks)${NC}"
        else
            echo -e "${RED}❌ Thumbnail Generator: Issues ($running/$desired tasks)${NC}"
        fi
    else
        echo -e "${RED}❌ Thumbnail Generator: Cannot access ECS service${NC}"
    fi
}

# Function to get recent CloudWatch logs
get_recent_errors() {
    local log_group=$1
    local display_name=$2
    
    local end_time=$(date +%s)000
    local start_time=$((end_time - 300000)) # Last 5 minutes
    
    local errors=$(aws logs filter-log-events \
        --log-group-name "$log_group" \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --filter-pattern "ERROR" \
        --region "$AWS_REGION" \
        --query 'events[*].message' \
        --output text 2>/dev/null | wc -l)
    
    if [ $? -eq 0 ]; then
        if [ "$errors" -eq 0 ]; then
            echo -e "${GREEN}✅ $display_name: No recent errors${NC}"
        elif [ "$errors" -lt 5 ]; then
            echo -e "${YELLOW}⚠️  $display_name: $errors errors in last 5 minutes${NC}"
        else
            echo -e "${RED}❌ $display_name: $errors errors in last 5 minutes${NC}"
        fi
    else
        echo -e "${YELLOW}❓ $display_name: Cannot access logs${NC}"
    fi
}

# Function to show queue dashboard
show_queue_dashboard() {
    echo -e "${CYAN}📬 SQS Queue Status${NC}"
    echo "==================="
    get_queue_metrics "$SQS_CAPTION_PARSER_QUEUE" "Caption Parser Queue"
    get_queue_metrics "$SQS_THUMBNAIL_GENERATOR_QUEUE" "Thumbnail Generator Queue"
    get_queue_metrics "$SQS_AUTO_TAGGER_QUEUE" "Auto Tagger Queue"
    echo ""
}

# Function to show service dashboard
show_service_dashboard() {
    echo -e "${CYAN}⚙️  Service Status${NC}"
    echo "=================="
    get_lambda_status "$PROJECT_NAME-$ENVIRONMENT-caption-parser" "Caption Parser"
    get_ecs_status
    get_lambda_status "$PROJECT_NAME-$ENVIRONMENT-auto-tagger" "Auto Tagger"
    echo ""
}

# Function to show error dashboard
show_error_dashboard() {
    echo -e "${CYAN}🚨 Error Monitoring${NC}"
    echo "==================="
    get_recent_errors "/aws/lambda/$PROJECT_NAME-$ENVIRONMENT-caption-parser" "Caption Parser"
    get_recent_errors "/aws/ecs/$PROJECT_NAME-$ENVIRONMENT/thumbnail-generator" "Thumbnail Generator"
    get_recent_errors "/aws/lambda/$PROJECT_NAME-$ENVIRONMENT-auto-tagger" "Auto Tagger"
    echo ""
}

# Function to show performance metrics
show_performance_metrics() {
    echo -e "${CYAN}📈 Performance Metrics (Last Hour)${NC}"
    echo "==================================="
    
    # Get Lambda invocation counts
    local end_time=$(date -u +"%Y-%m-%dT%H:%M:%S")
    local start_time=$(date -u -d '1 hour ago' +"%Y-%m-%dT%H:%M:%S")
    
    for function in "caption-parser" "auto-tagger"; do
        local invocations=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value="$PROJECT_NAME-$ENVIRONMENT-$function" \
            --start-time "$start_time" \
            --end-time "$end_time" \
            --period 3600 \
            --statistics Sum \
            --region "$AWS_REGION" \
            --query 'Datapoints[0].Sum' \
            --output text 2>/dev/null)
        
        if [ "$invocations" != "None" ] && [ ! -z "$invocations" ]; then
            echo -e "${GREEN}📊 $function: $invocations invocations${NC}"
        else
            echo -e "${YELLOW}📊 $function: No invocations${NC}"
        fi
    done
    echo ""
}

# Main monitoring function
monitor_continuous() {
    while true; do
        clear
        echo -e "${BLUE}📊 TikTok Commerce AI Workers Monitor${NC}"
        echo -e "${BLUE}=====================================${NC}"
        echo "$(date)"
        echo ""
        
        show_queue_dashboard
        show_service_dashboard
        show_error_dashboard
        show_performance_metrics
        
        echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
        sleep 30
    done
}

# Show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --queues      Show SQS queue status"
    echo "  --services    Show service status"
    echo "  --errors      Show recent errors"
    echo "  --metrics     Show performance metrics"
    echo "  --monitor     Continuous monitoring (default)"
    echo "  --help        Show this help message"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    --queues)
        show_queue_dashboard
        ;;
    --services)
        show_service_dashboard
        ;;
    --errors)
        show_error_dashboard
        ;;
    --metrics)
        show_performance_metrics
        ;;
    --help)
        show_help
        ;;
    *)
        monitor_continuous
        ;;
esac
