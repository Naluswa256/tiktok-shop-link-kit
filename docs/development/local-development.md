# Local Development Guide

This document provides comprehensive instructions for setting up and running the TikTok Commerce Link Hub in your local development environment using Docker Compose and LocalStack.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Service Architecture](#service-architecture)
- [Development Workflow](#development-workflow)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Testing](#testing)
- [Database Management](#database-management)
- [Performance Optimization](#performance-optimization)

## 🔄 Overview

The local development environment simulates the production AWS infrastructure using:

- **LocalStack**: AWS services emulation (S3, DynamoDB, SNS, SQS, Lambda)
- **Docker Compose**: Container orchestration for all services
- **Redis**: Caching layer
- **Admin UIs**: Web interfaces for database and cache management

### Architecture Comparison

| Component | Production | Local Development |
|-----------|------------|-------------------|
| Frontend | S3 + CloudFront | Vite Dev Server |
| APIs | ECS Fargate | Docker Containers |
| AI Workers | AWS Lambda | Docker Containers |
| Database | DynamoDB | LocalStack DynamoDB |
| Storage | S3 | LocalStack S3 |
| Messaging | SNS/SQS | LocalStack SNS/SQS |
| Cache | ElastiCache | Redis Container |

## 🛠️ Prerequisites

### Required Software
```bash
# Node.js 18+
node --version  # Should be 18.x or higher

# Python 3.11+
python3 --version  # Should be 3.11.x or higher

# Docker & Docker Compose
docker --version
docker-compose --version

# Git
git --version
```

### System Requirements
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space
- **CPU**: 4 cores recommended
- **OS**: Linux, macOS, or Windows with WSL2

## 🚀 Quick Start

### 1. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/your-org/tiktok-commerce-link-hub.git
cd tiktok-commerce-link-hub

# Install dependencies
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Key Environment Variables for Local Development:**
```bash
# Node.js Environment
NODE_ENV=development
LOG_LEVEL=debug

# LocalStack Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
DYNAMODB_ENDPOINT=http://localstack:4566
S3_ENDPOINT=http://localstack:4566
SNS_ENDPOINT=http://localstack:4566
SQS_ENDPOINT=http://localstack:4566

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# API Keys (Optional for basic testing)
OPENAI_API_KEY=your-openai-key-here
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token-here
```

### 3. Start Development Environment
```bash
# Start all services
npm run docker:up

# Or start services individually
docker-compose up -d localstack redis
docker-compose up frontend
```

### 4. Initialize LocalStack Resources
```bash
# Wait for LocalStack to be ready (about 30 seconds)
sleep 30

# Initialize AWS resources
./localstack-init/init.sh
```

### 5. Access Services
- **Frontend**: http://localhost:8080
- **Ingestion API**: http://localhost:3001
- **Product Service**: http://localhost:3002
- **WhatsApp Service**: http://localhost:3003
- **DynamoDB Admin**: http://localhost:8001
- **Redis Commander**: http://localhost:8002

## 🏗️ Service Architecture

### Frontend (React/Vite)
```yaml
frontend:
  build: ./apps/frontend/Dockerfile.dev
  ports: ["8080:8080"]
  volumes: 
    - "./apps/frontend:/app"
    - "/app/node_modules"
  environment:
    - VITE_API_URL=http://localhost:3001/api/v1
    - VITE_PRODUCT_API_URL=http://localhost:3002/api/v1
```

**Development Features:**
- **Hot Module Replacement**: Instant updates on code changes
- **Source Maps**: Full debugging support
- **Proxy Configuration**: API calls routed to backend services

### Backend Services (NestJS)

#### Ingestion API
```yaml
ingestion-api:
  build: ./apps/ingestion-api/Dockerfile.dev
  ports: ["3001:3001"]
  environment:
    - NODE_ENV=development
    - DYNAMODB_ENDPOINT=http://localstack:4566
    - SNS_ENDPOINT=http://localstack:4566
```

**Features:**
- **Auto-restart**: Nodemon for automatic restarts
- **Debug Mode**: Node.js debugging enabled
- **Live Reload**: TypeScript compilation on save

#### Product Service
```yaml
product-service:
  build: ./apps/product-service/Dockerfile.dev
  ports: ["3002:3002"]
  environment:
    - NODE_ENV=development
    - DYNAMODB_ENDPOINT=http://localstack:4566
    - S3_ENDPOINT=http://localstack:4566
```

### AI Workers (Python)

#### Caption Parser
```yaml
caption-parser:
  build: ./apps/ai-workers/caption-parser/Dockerfile.dev
  environment:
    - SNS_ENDPOINT=http://localstack:4566
    - OPENAI_API_KEY=${OPENAI_API_KEY}
```

**Development Features:**
- **Hot Reload**: Python auto-reload on file changes
- **Debug Logging**: Detailed logging for development
- **Mock Responses**: Fallback responses when APIs are unavailable

### Infrastructure Services

#### LocalStack
```yaml
localstack:
  image: localstack/localstack:3.0
  ports: ["4566:4566"]
  environment:
    - SERVICES=s3,dynamodb,sns,sqs,lambda
    - DEBUG=1
  volumes:
    - "./localstack-init:/etc/localstack/init/ready.d"
```

**Emulated Services:**
- **S3**: Object storage for files and images
- **DynamoDB**: NoSQL database tables
- **SNS**: Pub/sub messaging
- **SQS**: Message queues with DLQ support
- **Lambda**: Serverless function execution

#### Redis
```yaml
redis:
  image: redis:7-alpine
  ports: ["6379:6379"]
  command: redis-server --appendonly yes
```

## 🔄 Development Workflow

### Daily Development Process

#### 1. Start Development Environment
```bash
# Start all services
npm run docker:up

# Check service health
docker-compose ps
```

#### 2. Make Code Changes
```bash
# Frontend changes (auto-reload)
# Edit files in apps/frontend/src/

# Backend changes (auto-restart)
# Edit files in apps/ingestion-api/src/

# AI worker changes (auto-reload)
# Edit files in apps/ai-workers/*/
```

#### 3. Test Changes
```bash
# Run unit tests
npm run test

# Run specific service tests
npm run test --workspace=apps/frontend
npm run test --workspace=apps/ingestion-api

# Run integration tests
npm run test:integration
```

#### 4. Debug Issues
```bash
# View logs
docker-compose logs frontend
docker-compose logs ingestion-api
docker-compose logs localstack

# Follow logs in real-time
docker-compose logs -f ingestion-api
```

### Code Quality Workflow

#### Pre-commit Checks
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

#### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat(frontend): add new product catalog component"

# Push changes
git push origin feature/new-feature
```

## 🐛 Debugging & Troubleshooting

### Common Issues

#### 1. Services Not Starting
**Symptoms**: Docker containers fail to start
**Solutions**:
```bash
# Check Docker daemon
sudo systemctl status docker

# Check available ports
netstat -tulpn | grep :8080

# Restart Docker Compose
docker-compose down
docker-compose up -d
```

#### 2. LocalStack Connection Issues
**Symptoms**: AWS service calls fail
**Solutions**:
```bash
# Check LocalStack status
curl http://localhost:4566/health

# Restart LocalStack
docker-compose restart localstack

# Re-initialize resources
./localstack-init/init.sh
```

#### 3. Database Connection Issues
**Symptoms**: DynamoDB operations fail
**Solutions**:
```bash
# Check DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Verify table structure
aws --endpoint-url=http://localhost:4566 dynamodb describe-table \
  --table-name tiktok-videos-dev
```

#### 4. Frontend Build Issues
**Symptoms**: Vite build fails or hot reload not working
**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules apps/frontend/node_modules
npm install

# Restart frontend service
docker-compose restart frontend
```

### Debugging Tools

#### 1. Service Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs ingestion-api

# Follow logs in real-time
docker-compose logs -f --tail=100 ingestion-api
```

#### 2. Database Inspection
```bash
# Access DynamoDB Admin UI
open http://localhost:8001

# Query tables via CLI
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name tiktok-videos-dev
```

#### 3. Redis Inspection
```bash
# Access Redis Commander UI
open http://localhost:8002

# Connect via CLI
docker-compose exec redis redis-cli
```

#### 4. Network Debugging
```bash
# Check container networking
docker network ls
docker network inspect tiktok-shop-link-kit_tiktok-network

# Test connectivity between containers
docker-compose exec frontend ping ingestion-api
```

### Performance Debugging

#### 1. Resource Usage
```bash
# Monitor container resources
docker stats

# Check system resources
htop
df -h
```

#### 2. Application Performance
```bash
# Node.js memory usage
docker-compose exec ingestion-api node -e "console.log(process.memoryUsage())"

# Python memory usage
docker-compose exec caption-parser python -c "import psutil; print(psutil.virtual_memory())"
```

## 🧪 Testing

### Unit Testing

#### Frontend Tests
```bash
# Run React component tests
npm run test --workspace=apps/frontend

# Run tests in watch mode
npm run test:watch --workspace=apps/frontend

# Generate coverage report
npm run test:coverage --workspace=apps/frontend
```

#### Backend Tests
```bash
# Run NestJS tests
npm run test --workspace=apps/ingestion-api

# Run specific test file
npm run test --workspace=apps/ingestion-api -- ingestion.service.spec.ts

# Run E2E tests
npm run test:e2e --workspace=apps/ingestion-api
```

#### AI Worker Tests
```bash
# Run Python tests
cd apps/ai-workers/caption-parser
python -m pytest

# Run with coverage
python -m pytest --cov=. --cov-report=html
```

### Integration Testing

#### API Testing
```bash
# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3002/api/v1/products

# Test with data
curl -X POST http://localhost:3001/api/v1/ingestion/tiktok-link \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@test/video/123"}'
```

#### Message Queue Testing
```bash
# Send test message to SQS
aws --endpoint-url=http://localhost:4566 sqs send-message \
  --queue-url http://localhost:4566/000000000000/tiktok-caption-analysis-dev \
  --message-body '{"videoId": "test-123", "url": "https://test.com"}'

# Check queue messages
aws --endpoint-url=http://localhost:4566 sqs receive-message \
  --queue-url http://localhost:4566/000000000000/tiktok-caption-analysis-dev
```

### Load Testing

#### Simple Load Testing
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API endpoint
ab -n 100 -c 10 http://localhost:3001/health

# Test with POST data
ab -n 50 -c 5 -p test-data.json -T application/json \
  http://localhost:3001/api/v1/ingestion/tiktok-link
```

## 💾 Database Management

### DynamoDB Operations

#### Table Management
```bash
# List tables
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Create table (if not exists)
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name test-table \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

#### Data Operations
```bash
# Insert item
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name tiktok-videos-dev \
  --item '{"id": {"S": "test-123"}, "url": {"S": "https://test.com"}}'

# Query items
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name tiktok-videos-dev

# Update item
aws --endpoint-url=http://localhost:4566 dynamodb update-item \
  --table-name tiktok-videos-dev \
  --key '{"id": {"S": "test-123"}}' \
  --update-expression "SET #status = :status" \
  --expression-attribute-names '{"#status": "status"}' \
  --expression-attribute-values '{":status": {"S": "processed"}}'
```

### Redis Operations

#### Cache Management
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Basic operations
SET key "value"
GET key
DEL key
KEYS *

# Check memory usage
INFO memory
```

### Data Seeding

#### Seed Sample Data
```bash
# Run seeding script
npm run seed:dev

# Or manually seed specific data
node scripts/seed-products.js
node scripts/seed-videos.js
```

## ⚡ Performance Optimization

### Development Performance

#### 1. Docker Optimization
```yaml
# Use multi-stage builds
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "dev"]
```

#### 2. Volume Optimization
```yaml
# Use bind mounts for source code
volumes:
  - "./apps/frontend:/app"
  - "/app/node_modules"  # Anonymous volume for node_modules
```

#### 3. Resource Limits
```yaml
# Set resource limits
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

### Application Performance

#### 1. Frontend Optimization
```bash
# Enable Vite optimizations
# vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  }
})
```

#### 2. Backend Optimization
```typescript
// Enable compression
app.use(compression());

// Set up caching
app.use(cache('5 minutes'));

// Connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 3. Database Optimization
```bash
# Use local secondary indexes
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name optimized-table \
  --local-secondary-indexes IndexName=LSI1,KeySchema=[...],Projection=[...]
```

---

**Next**: [Production vs Development Comparison](../deployment/environment-comparison.md)
