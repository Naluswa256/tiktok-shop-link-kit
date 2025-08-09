#!/bin/bash

# TikTok Commerce Link Hub - Service Deployment Script
# Usage: ./scripts/deploy-services.sh <environment> [service]
# Example: ./scripts/deploy-services.sh prod ingestion-api

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if environment is provided
if [ $# -eq 0 ]; then
    log_error "Environment not specified"
    echo "Usage: $0 <environment> [service]"
    echo "Available environments: dev, staging, prod"
    echo "Available services: ingestion-api, product-service, thumbnail-generator, caption-parser, all"
    exit 1
fi

ENVIRONMENT=$1
SERVICE=${2:-"all"}
PROJECT_NAME="buylink"
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    echo "Available environments: dev, staging, prod"
    exit 1
fi

# Validate service
VALID_SERVICES=("ingestion-api" "product-service" "thumbnail-generator" "caption-parser" "all")
if [[ ! " ${VALID_SERVICES[@]} " =~ " ${SERVICE} " ]]; then
    log_error "Invalid service: $SERVICE"
    echo "Available services: ${VALID_SERVICES[*]}"
    exit 1
fi

echo "=== TikTok Commerce Link Hub Service Deployment ==="
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Service: $SERVICE"
log_info "AWS Region: $AWS_REGION"
echo ""

# Check AWS credentials
log_info "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    log_success "AWS credentials configured for account: $AWS_ACCOUNT"
else
    log_error "AWS credentials not configured or invalid"
    echo "Please run 'aws configure' or set AWS environment variables"
    exit 1
fi

# Check if Docker is running
log_info "Checking Docker..."
if docker info &> /dev/null; then
    log_success "Docker is running"
else
    log_error "Docker is not running or not accessible"
    exit 1
fi

# Function to build and push Docker image
build_and_push_image() {
    local service_name=$1
    local dockerfile=$2
    local context=$3
    
    log_info "Building and pushing $service_name..."
    
    # ECR repository name
    local ecr_repo="${PROJECT_NAME}-${ENVIRONMENT}-${service_name}"
    local ecr_uri="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ecr_repo}"
    local image_tag=$(git rev-parse --short HEAD)
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ecr_uri
    
    # Build image
    log_info "Building Docker image for $service_name..."
    docker build -f $context/$dockerfile -t $ecr_uri:$image_tag -t $ecr_uri:latest $context
    
    # Push image
    log_info "Pushing Docker image for $service_name..."
    docker push $ecr_uri:$image_tag
    docker push $ecr_uri:latest
    
    log_success "Image pushed: $ecr_uri:$image_tag"
}

# Function to deploy ECS service
deploy_ecs_service() {
    local service_name=$1
    
    log_info "Deploying ECS service: $service_name..."
    
    local cluster_name="${PROJECT_NAME}-${ENVIRONMENT}-cluster"
    local ecs_service_name="${PROJECT_NAME}-${ENVIRONMENT}-${service_name}"
    
    # Update ECS service
    aws ecs update-service \
        --cluster $cluster_name \
        --service $ecs_service_name \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    log_info "Waiting for service to stabilize..."
    
    # Wait for deployment to complete
    aws ecs wait services-stable \
        --cluster $cluster_name \
        --services $ecs_service_name \
        --region $AWS_REGION
    
    log_success "Service $service_name deployed successfully"
}

# Function to check service health
check_service_health() {
    local service_name=$1
    
    # Only check health for services with HTTP endpoints
    if [[ "$service_name" == "ingestion-api" || "$service_name" == "product-service" ]]; then
        log_info "Checking health for $service_name..."
        
        # Get ALB DNS name
        local alb_name="${PROJECT_NAME}-${ENVIRONMENT}-alb"
        local alb_dns=$(aws elbv2 describe-load-balancers \
            --names $alb_name \
            --query 'LoadBalancers[0].DNSName' \
            --output text 2>/dev/null || echo "")
        
        if [ -z "$alb_dns" ]; then
            log_warning "Could not get ALB DNS name, skipping health check"
            return
        fi
        
        # Determine health endpoint
        local health_endpoint=""
        case "$service_name" in
            "ingestion-api")
                health_endpoint="http://$alb_dns/api/ingestion/health"
                ;;
            "product-service")
                health_endpoint="http://$alb_dns/api/products/health"
                ;;
        esac
        
        # Check health
        local max_attempts=30
        for i in $(seq 1 $max_attempts); do
            if curl -f -s "$health_endpoint" > /dev/null 2>&1; then
                log_success "$service_name is healthy"
                return
            fi
            
            if [ $i -eq $max_attempts ]; then
                log_warning "$service_name health check failed after $max_attempts attempts"
                return
            fi
            
            echo "Health check attempt $i/$max_attempts failed, waiting 10 seconds..."
            sleep 10
        done
    else
        log_info "Skipping health check for $service_name (no HTTP endpoint)"
    fi
}

# Define services to deploy
if [ "$SERVICE" == "all" ]; then
    SERVICES=("ingestion-api" "product-service" "thumbnail-generator" "caption-parser")
else
    SERVICES=("$SERVICE")
fi

echo ""
echo "=== Building and Pushing Docker Images ==="
echo ""

# Build and push images
for service in "${SERVICES[@]}"; do
    case "$service" in
        "ingestion-api")
            build_and_push_image "$service" "Dockerfile" "apps/ingestion-api"
            ;;
        "product-service")
            build_and_push_image "$service" "Dockerfile" "apps/product-service"
            ;;
        "thumbnail-generator")
            build_and_push_image "$service" "Dockerfile.worker" "apps/ai-workers/thumbnail-generator"
            ;;
        "caption-parser")
            build_and_push_image "$service" "Dockerfile" "apps/ai-workers/caption-parser"
            ;;
    esac
done

echo ""
echo "=== Deploying ECS Services ==="
echo ""

# Deploy services
for service in "${SERVICES[@]}"; do
    deploy_ecs_service "$service"
done

echo ""
echo "=== Health Checks ==="
echo ""

# Check service health
for service in "${SERVICES[@]}"; do
    check_service_health "$service"
done

echo ""
echo "=== Deployment Summary ==="
echo ""

log_success "Deployment completed successfully!"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Services deployed: ${SERVICES[*]}"
echo "Git commit: $(git rev-parse --short HEAD)"
echo "Deployed at: $(date)"

# Get service URLs
log_info "Service endpoints:"
local alb_name="${PROJECT_NAME}-${ENVIRONMENT}-alb"
local alb_dns=$(aws elbv2 describe-load-balancers \
    --names $alb_name \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null || echo "N/A")

if [ "$alb_dns" != "N/A" ]; then
    echo "  - Ingestion API: http://$alb_dns/api/ingestion"
    echo "  - Product Service: http://$alb_dns/api/products"
else
    echo "  - ALB DNS not available"
fi

echo ""
log_success "Deployment script completed successfully!"
