#!/bin/bash

# ECR Repository Creation Script
# Usage: ./create-ecr-repos.sh

set -e

REGION="us-east-1"
PROJECT_NAME="buylink"
ENVIRONMENTS=("dev" "staging" "prod")
SERVICES=("ingestion-api" "product-service" "thumbnail-generator" "caption-parser" "scheduled-ingestion")

echo "Creating ECR repositories for TikTok Commerce Link Hub..."

for env in "${ENVIRONMENTS[@]}"; do
    echo ""
    echo "Creating repositories for environment: $env"
    
    for service in "${SERVICES[@]}"; do
        REPO_NAME="${PROJECT_NAME}-${env}-${service}"
        
        echo "Creating repository: $REPO_NAME"
        
        # Check if repository already exists
        if aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" >/dev/null 2>&1; then
            echo "  ✓ Repository $REPO_NAME already exists"
        else
            # Create repository with image scanning for production
            if [ "$env" = "prod" ]; then
                aws ecr create-repository \
                    --repository-name "$REPO_NAME" \
                    --image-scanning-configuration scanOnPush=true \
                    --region "$REGION" >/dev/null
                echo "  ✓ Created $REPO_NAME with image scanning"
            else
                aws ecr create-repository \
                    --repository-name "$REPO_NAME" \
                    --region "$REGION" >/dev/null
                echo "  ✓ Created $REPO_NAME"
            fi
        fi
    done
done

echo ""
echo "✅ All ECR repositories created successfully!"
echo ""
echo "Repository list:"
aws ecr describe-repositories --region "$REGION" --query 'repositories[?starts_with(repositoryName, `buylink-`)].repositoryName' --output table