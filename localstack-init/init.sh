#!/bin/bash

echo "Initializing LocalStack services..."

# Wait for LocalStack to be ready
sleep 10

# Create S3 Buckets
echo "Creating S3 buckets..."
awslocal s3 mb s3://tiktok-commerce-assets-dev
awslocal s3 mb s3://tiktok-commerce-thumbnails-dev

# Enable public read access for assets bucket
awslocal s3api put-bucket-policy --bucket tiktok-commerce-assets-dev --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tiktok-commerce-assets-dev/*"
    }
  ]
}'

# Enable public read access for thumbnails bucket
awslocal s3api put-bucket-policy --bucket tiktok-commerce-thumbnails-dev --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tiktok-commerce-thumbnails-dev/*"
    }
  ]
}'

# Create DynamoDB Tables
echo "Creating DynamoDB tables..."

# Videos table
awslocal dynamodb create-table \
  --table-name tiktok-videos-dev \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=UserIndex,KeySchema=[{AttributeName=userId,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST

# Products table
awslocal dynamodb create-table \
  --table-name tiktok-products-dev \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=category,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=CategoryIndex,KeySchema=[{AttributeName=category,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST

# Processing jobs table
awslocal dynamodb create-table \
  --table-name tiktok-processing-jobs-dev \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=videoId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=VideoIndex,KeySchema=[{AttributeName=videoId,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=StatusIndex,KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST

# Tags table
awslocal dynamodb create-table \
  --table-name tiktok-tags-dev \
  --attribute-definitions \
    AttributeName=tag,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=tag,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# Trends table
awslocal dynamodb create-table \
  --table-name tiktok-trends-dev \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=date,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
    AttributeName=date,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# Create SNS Topic
echo "Creating SNS topic..."
awslocal sns create-topic --name tiktok-processing-dev

# Create SQS Queues
echo "Creating SQS queues..."

# Caption analysis queue
awslocal sqs create-queue --queue-name tiktok-caption-analysis-dev
awslocal sqs create-queue --queue-name tiktok-caption-analysis-dlq-dev

# Thumbnail generation queue
awslocal sqs create-queue --queue-name tiktok-thumbnail-generation-dev
awslocal sqs create-queue --queue-name tiktok-thumbnail-generation-dlq-dev

# Auto tagging queue
awslocal sqs create-queue --queue-name tiktok-auto-tagging-dev
awslocal sqs create-queue --queue-name tiktok-auto-tagging-dlq-dev

# Subscribe SQS queues to SNS topic
echo "Setting up SNS to SQS subscriptions..."
TOPIC_ARN="arn:aws:sns:us-east-1:000000000000:tiktok-processing-dev"

awslocal sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:tiktok-caption-analysis-dev

awslocal sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:tiktok-thumbnail-generation-dev

awslocal sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:tiktok-auto-tagging-dev

# Set up queue policies to allow SNS to send messages
echo "Setting up SQS queue policies..."

# Caption analysis queue policy
awslocal sqs set-queue-attributes \
  --queue-url http://localhost:4566/000000000000/tiktok-caption-analysis-dev \
  --attributes '{
    "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sns.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"arn:aws:sqs:us-east-1:000000000000:tiktok-caption-analysis-dev\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"arn:aws:sns:us-east-1:000000000000:tiktok-processing-dev\"}}}]}"
  }'

# Thumbnail generation queue policy
awslocal sqs set-queue-attributes \
  --queue-url http://localhost:4566/000000000000/tiktok-thumbnail-generation-dev \
  --attributes '{
    "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sns.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"arn:aws:sqs:us-east-1:000000000000:tiktok-thumbnail-generation-dev\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"arn:aws:sns:us-east-1:000000000000:tiktok-processing-dev\"}}}]}"
  }'

# Auto tagging queue policy
awslocal sqs set-queue-attributes \
  --queue-url http://localhost:4566/000000000000/tiktok-auto-tagging-dev \
  --attributes '{
    "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sns.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"arn:aws:sqs:us-east-1:000000000000:tiktok-auto-tagging-dev\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"arn:aws:sns:us-east-1:000000000000:tiktok-processing-dev\"}}}]}"
  }'

# Seed some sample data
echo "Seeding sample data..."

# Add sample video
awslocal dynamodb put-item \
  --table-name tiktok-videos-dev \
  --item '{
    "id": {"S": "sample-video-1"},
    "url": {"S": "https://www.tiktok.com/@sample/video/123456789"},
    "caption": {"S": "Check out this amazing summer dress! Perfect for any occasion 🌞 #fashion #style #summer"},
    "userId": {"S": "user-123"},
    "username": {"S": "fashionista"},
    "hashtags": {"SS": ["fashion", "style", "summer"]},
    "createdAt": {"S": "2024-01-01T00:00:00.000Z"},
    "updatedAt": {"S": "2024-01-01T00:00:00.000Z"}
  }'

# Add sample product
awslocal dynamodb put-item \
  --table-name tiktok-products-dev \
  --item '{
    "id": {"S": "product-1"},
    "name": {"S": "Summer Floral Dress"},
    "description": {"S": "Beautiful floral dress perfect for summer occasions"},
    "price": {"N": "2999"},
    "category": {"S": "fashion"},
    "status": {"S": "active"},
    "images": {"SS": ["https://example.com/dress1.jpg", "https://example.com/dress2.jpg"]},
    "tags": {"SS": ["summer", "dress", "floral", "fashion"]},
    "tiktokVideoId": {"S": "sample-video-1"},
    "createdAt": {"S": "2024-01-01T00:00:00.000Z"},
    "updatedAt": {"S": "2024-01-01T00:00:00.000Z"}
  }'

echo "LocalStack initialization completed!"
echo "Services available:"
echo "- DynamoDB Admin: http://localhost:8001"
echo "- Redis Commander: http://localhost:8002"
echo "- Frontend: http://localhost:8080"
echo "- Ingestion API: http://localhost:3001"
echo "- Product Service: http://localhost:3002"
echo "- WhatsApp Service: http://localhost:3003"
