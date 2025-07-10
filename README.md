# TikTok Commerce Link Hub

A comprehensive event-driven microservice platform that transforms TikTok content into thriving e-commerce opportunities. Built with modern technologies including NestJS, React, Python AI workers, and AWS cloud infrastructure.

## 🚀 Architecture Overview

This is an **event-driven microservice AWS architecture** designed for:
- **99.99% uptime** via multi-AZ, health checks, retries, DLQs, circuit breakers
- **Performance & Scalability** with stateless NestJS microservices that auto-scale on CPU/queue depth
- **Maintainability & Modularity** with clear separation of concerns

### High-Level Architecture
```
AWS API Gateway → NestJS Ingestion Service
AWS SNS Topics + SQS Queues (with DLQs) → AI Workers (Caption Parser, Thumbnail Generator, Auto-Tagger) on ECS Fargate/Lambda
NestJS Product Service → DynamoDB/Aurora + CloudFront cache invalidation
React Frontend on Vercel (or S3 + CloudFront)
NestJS WhatsApp Integration via Lambda
Monitoring: CloudWatch, X-Ray, Prometheus + Grafana
```

## 📁 Project Structure

```
tiktok-commerce-link-hub/
├── apps/                          # Applications
│   ├── frontend/                  # React/Vite frontend
│   ├── ingestion-api/            # NestJS ingestion service
│   ├── product-service/          # NestJS product management
│   ├── whatsapp-service/         # NestJS WhatsApp integration
│   └── ai-workers/               # Python AI workers
│       ├── caption-parser/       # Caption analysis AI
│       ├── thumbnail-generator/  # Thumbnail generation AI
│       └── auto-tagger/         # Auto-tagging AI
├── libs/                         # Shared libraries
│   ├── common/                   # DTOs, interfaces, utilities
│   └── config/                   # Centralized configuration
├── infra/                        # Infrastructure as Code
│   └── terraform/                # Terraform modules
│       └── modules/              # Reusable Terraform modules
├── .github/workflows/            # CI/CD pipelines
└── docker-compose.yml           # Local development environment
```

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **React Query** for data fetching
- **React Router** for navigation

### Backend Services
- **NestJS** with TypeScript
- **AWS Lambda** for serverless functions
- **Express.js** for HTTP servers
- **Swagger/OpenAPI** for API documentation

### AI Workers
- **Python 3.11** with asyncio
- **OpenAI GPT** for content analysis
- **Transformers** for ML models
- **Pillow** for image processing
- **AWS Lambda Powertools** for observability

### Infrastructure
- **AWS** (DynamoDB, S3, SNS, SQS, Lambda, ECS)
- **Terraform** for Infrastructure as Code
- **Docker** for containerization
- **LocalStack** for local AWS emulation

### Development Tools
- **Nx** for monorepo management
- **ESLint** & **Prettier** for code quality
- **Husky** for git hooks
- **Jest** for testing
- **GitHub Actions** for CI/CD

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- AWS CLI (for production deployment)
- Terraform (for infrastructure)

### 1. Clone and Install
```bash
git clone <repository-url>
cd tiktok-commerce-link-hub
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Local Development
```bash
# Start all services with Docker Compose
npm run docker:up

# Or start individual services
npm run dev:frontend    # Frontend on :8080
npm run dev:ingestion   # Ingestion API on :3001
npm run dev:product     # Product Service on :3002
```

### 4. Access Services
- **Frontend**: http://localhost:8080
- **Ingestion API**: http://localhost:3001
- **Product Service**: http://localhost:3002
- **DynamoDB Admin**: http://localhost:8001
- **Redis Commander**: http://localhost:8002

## 📚 Development Guide

### Building the Project
```bash
# Build all applications
npm run build

# Build specific applications
npm run build:frontend
npm run build:services
```

### Testing
```bash
# Run all tests
npm run test

# Run tests for specific workspace
npm run test --workspace=apps/frontend
npm run test --workspace=libs/common
```

### Code Quality
```bash
# Lint all code
npm run lint

# Format all code
npm run format

# Type checking
npm run type-check
```

### Working with AI Workers
```bash
# Install Python dependencies
cd apps/ai-workers/caption-parser
pip install -r requirements.txt

# Run locally
python main.py
```

## 🏗️ Infrastructure Deployment

### Local Development with LocalStack
```bash
# Start LocalStack and all services
docker-compose up -d

# Initialize LocalStack resources
./localstack-init/init.sh
```

### AWS Production Deployment
```bash
# Plan infrastructure changes
npm run infra:plan

# Apply infrastructure changes
npm run infra:apply

# Destroy infrastructure (careful!)
npm run infra:destroy
```

## 🔧 Configuration

### Environment Variables
Key environment variables (see `.env.example` for complete list):

- `NODE_ENV`: Environment (development/production)
- `AWS_REGION`: AWS region for services
- `OPENAI_API_KEY`: OpenAI API key for AI workers
- `WHATSAPP_ACCESS_TOKEN`: WhatsApp Business API token
- `DATABASE_URL`: Database connection string

### Feature Flags
- `ENABLE_AI_PROCESSING`: Enable/disable AI workers
- `ENABLE_WHATSAPP_INTEGRATION`: Enable/disable WhatsApp features
- `ENABLE_ANALYTICS`: Enable/disable analytics collection

## 📊 Monitoring & Observability

### Local Development
- **DynamoDB Admin**: Web UI for DynamoDB tables
- **Redis Commander**: Web UI for Redis cache
- **Application Logs**: Available via `docker-compose logs`

### Production
- **CloudWatch**: Logs and metrics
- **AWS X-Ray**: Distributed tracing
- **Custom Dashboards**: Performance monitoring
- **Alerts**: Automated notifications for issues

## 🧪 Testing Strategy

### Unit Tests
- **Frontend**: Jest + React Testing Library
- **Backend**: Jest + Supertest
- **AI Workers**: pytest

### Integration Tests
- **API Testing**: Automated API endpoint testing
- **Database Testing**: DynamoDB integration tests
- **Message Queue Testing**: SNS/SQS integration tests

### E2E Tests
- **Frontend E2E**: Playwright/Cypress
- **API E2E**: Full workflow testing

## 🚀 Deployment

### CI/CD Pipeline
The project uses GitHub Actions for automated:
1. **Code Quality**: Linting, formatting, type checking
2. **Testing**: Unit, integration, and E2E tests
3. **Building**: Docker images for all services
4. **Infrastructure**: Terraform plan and apply
5. **Deployment**: Automated deployment to AWS

### Deployment Environments
- **Development**: Local with Docker Compose + LocalStack
- **Staging**: AWS with reduced capacity
- **Production**: Full AWS deployment with high availability

## 📈 Performance Considerations

### Scalability
- **Auto-scaling**: ECS services scale based on CPU/memory
- **Queue-based Processing**: Async processing via SQS
- **Caching**: Redis for frequently accessed data
- **CDN**: CloudFront for static assets

### Cost Optimization
- **Serverless**: Lambda functions for AI workers
- **Spot Instances**: For development environments
- **Resource Scheduling**: Scale down during off-hours
- **Monitoring**: Cost alerts and optimization recommendations

## 🔒 Security

### Authentication & Authorization
- **JWT Tokens**: Secure API authentication
- **Role-based Access**: Different permission levels
- **API Rate Limiting**: Prevent abuse

### Data Security
- **Encryption**: At rest and in transit
- **Secrets Management**: AWS Secrets Manager
- **Network Security**: VPC, security groups, NACLs

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `develop`
2. Make changes following coding standards
3. Write/update tests
4. Submit pull request
5. Code review and merge

### Coding Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced code quality rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Standardized commit messages

## 📝 API Documentation

### REST APIs
- **Ingestion API**: http://localhost:3001/api/docs
- **Product Service**: http://localhost:3002/api/docs
- **WhatsApp Service**: http://localhost:3003/api/docs

### GraphQL (Future)
- Unified GraphQL endpoint for frontend consumption
- Real-time subscriptions for live updates

## 🗺️ Roadmap

### Phase 1: Foundation ✅
- [x] Monorepo setup with Nx
- [x] Basic NestJS services
- [x] AI workers infrastructure
- [x] Local development environment
- [x] CI/CD pipeline

### Phase 2: Core Features (In Progress)
- [ ] TikTok video ingestion
- [ ] AI-powered content analysis
- [ ] Product catalog management
- [ ] WhatsApp integration

### Phase 3: Advanced Features
- [ ] Real-time analytics dashboard
- [ ] Advanced AI recommendations
- [ ] Multi-tenant support
- [ ] Mobile app

### Phase 4: Scale & Optimize
- [ ] Global CDN deployment
- [ ] Advanced caching strategies
- [ ] Machine learning optimization
- [ ] Enterprise features

## 📞 Support

### Documentation
- **API Docs**: Available at `/api/docs` for each service
- **Architecture Docs**: In `/docs` directory
- **Runbooks**: Operational procedures

### Getting Help
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Wiki**: Detailed documentation and guides

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the TikTok Commerce ecosystem**
