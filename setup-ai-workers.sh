#!/bin/bash

# Quick Setup Script for TikTok Commerce AI Workers
# Makes all scripts executable and validates environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 TikTok Commerce AI Workers Setup${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Make all scripts executable
echo -e "${YELLOW}📝 Making scripts executable...${NC}"
chmod +x deploy-ai-workers.sh
chmod +x start-local-dev.sh
chmod +x monitor-ai-workers.sh
chmod +x apps/ai-workers/thumbnail-generator/start-production.sh
echo -e "${GREEN}✅ Scripts are now executable${NC}"
echo ""

# Check required tools
echo -e "${YELLOW}🔍 Checking required tools...${NC}"

check_tool() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 is installed${NC}"
    else
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    fi
}

MISSING_TOOLS=0

check_tool "aws" || MISSING_TOOLS=$((MISSING_TOOLS + 1))
check_tool "docker" || MISSING_TOOLS=$((MISSING_TOOLS + 1))
check_tool "node" || MISSING_TOOLS=$((MISSING_TOOLS + 1))
check_tool "npm" || MISSING_TOOLS=$((MISSING_TOOLS + 1))
check_tool "terraform" || MISSING_TOOLS=$((MISSING_TOOLS + 1))
check_tool "curl" || MISSING_TOOLS=$((MISSING_TOOLS + 1))
check_tool "jq" || MISSING_TOOLS=$((MISSING_TOOLS + 1))

if [ $MISSING_TOOLS -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ $MISSING_TOOLS required tools are missing. Please install them first.${NC}"
    exit 1
fi

echo ""

# Check environment variables
echo -e "${YELLOW}🔍 Checking environment variables...${NC}"

check_env() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}❌ $1 is not set${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is set${NC}"
        return 0
    fi
}

MISSING_ENV=0

check_env "AWS_ACCESS_KEY_ID" || MISSING_ENV=$((MISSING_ENV + 1))
check_env "AWS_SECRET_ACCESS_KEY" || MISSING_ENV=$((MISSING_ENV + 1))
check_env "AWS_REGION" || MISSING_ENV=$((MISSING_ENV + 1))

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  OPENROUTER_API_KEY is not set (required for LLM services)${NC}"
    MISSING_ENV=$((MISSING_ENV + 1))
else
    echo -e "${GREEN}✅ OPENROUTER_API_KEY is set${NC}"
fi

echo ""

# Test AWS connection
echo -e "${YELLOW}🔍 Testing AWS connection...${NC}"
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${GREEN}✅ AWS connection successful${NC}"
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity --query Arn --output text)
    echo "  Account: $AWS_ACCOUNT"
    echo "  User: $AWS_USER"
else
    echo -e "${RED}❌ AWS connection failed${NC}"
    MISSING_ENV=$((MISSING_ENV + 1))
fi

echo ""

# Test Docker
echo -e "${YELLOW}🔍 Testing Docker...${NC}"
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker is running${NC}"
else
    echo -e "${RED}❌ Docker is not running${NC}"
    MISSING_ENV=$((MISSING_ENV + 1))
fi

echo ""

# Show setup status
if [ $MISSING_ENV -gt 0 ]; then
    echo -e "${RED}❌ Setup incomplete. Please fix the issues above.${NC}"
    echo ""
    echo -e "${YELLOW}💡 To set environment variables:${NC}"
    echo "export AWS_ACCESS_KEY_ID=\"your-access-key\""
    echo "export AWS_SECRET_ACCESS_KEY=\"your-secret-key\""
    echo "export AWS_REGION=\"us-east-1\""
    echo "export OPENROUTER_API_KEY=\"your-openrouter-api-key\""
    echo ""
    exit 1
else
    echo -e "${GREEN}🎉 Setup complete! All requirements are satisfied.${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo ""
    echo -e "${BLUE}1. Deploy AI Workers to Production:${NC}"
    echo "   ./deploy-ai-workers.sh"
    echo ""
    echo -e "${BLUE}2. Start Local Development:${NC}"
    echo "   ./start-local-dev.sh"
    echo ""
    echo -e "${BLUE}3. Monitor AI Workers:${NC}"
    echo "   ./monitor-ai-workers.sh"
    echo ""
    echo -e "${BLUE}4. Read the Documentation:${NC}"
    echo "   cat AI-WORKERS-DEPLOYMENT.md"
    echo ""
    echo -e "${GREEN}✨ You're ready to deploy!${NC}"
fi
