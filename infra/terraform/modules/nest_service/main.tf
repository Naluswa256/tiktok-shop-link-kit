# CloudWatch Log Group for the service
resource "aws_cloudwatch_log_group" "service_logs" {
  count             = var.enable_logging ? 1 : 0
  name              = "/aws/lambda/${var.service_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.service_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM policy for DynamoDB and other AWS services
resource "aws_iam_role_policy" "lambda_service_policy" {
  name = "${var.service_name}-lambda-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda function (placeholder - would need actual deployment package)
resource "aws_lambda_function" "service" {
  function_name = var.service_name
  role         = aws_iam_role.lambda_execution_role.arn
  handler      = "index.handler"
  runtime      = "nodejs18.x"
  timeout      = 30
  memory_size  = var.memory

  # Placeholder code - in real deployment, this would be a zip file
  filename         = "${path.module}/placeholder.zip"
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = var.environment_variables
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.service_logs
  ]

  tags = var.tags
}

# Create a placeholder zip file for the Lambda function
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"
  
  source {
    content = jsonencode({
      message = "Placeholder Lambda function for ${var.service_name}"
      note    = "Replace this with actual NestJS application code"
    })
    filename = "index.js"
  }
}

# Lambda function URL (for HTTP access)
resource "aws_lambda_function_url" "service_url" {
  function_name      = aws_lambda_function.service.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["date", "keep-alive"]
    expose_headers    = ["date", "keep-alive"]
    max_age          = 86400
  }
}

# CloudWatch alarms for monitoring (optional)
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.service_name}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors lambda errors"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.service.function_name
  }

  tags = var.tags
}
