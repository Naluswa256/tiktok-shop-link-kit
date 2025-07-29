# AWS Cognito Password Authentication Configuration

This document provides step-by-step instructions for configuring AWS Cognito to support password-based authentication for the TikTok Commerce application.

## Overview

The application uses AWS Cognito User Pools with password-based authentication where:
- **Username**: TikTok handle (stored in `preferred_username` attribute)
- **Password**: User-defined secure password
- **Authentication Flow**: `USER_PASSWORD_AUTH`

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (optional but recommended)
- Access to AWS Console

## Step 1: Create Cognito User Pool

### 1.1 Navigate to Cognito Service
1. Log in to AWS Console
2. Navigate to **Amazon Cognito**
3. Click **"Create user pool"**

### 1.2 Configure Sign-in Experience
1. **Authentication providers**: Select **"Cognito user pool"**
2. **Cognito user pool sign-in options**:
   - ✅ **Username**
   - ❌ Email (uncheck)
   - ❌ Phone number (uncheck)
3. **Username requirements**:
   - ✅ **Allow users to sign in with a preferred username**
   - ❌ Case sensitivity (uncheck for easier UX)

### 1.3 Configure Security Requirements
1. **Password policy**:
   - **Minimum length**: 8 characters
   - ✅ **Contains at least 1 number**
   - ✅ **Contains at least 1 special character**
   - ✅ **Contains at least 1 uppercase letter**
   - ✅ **Contains at least 1 lowercase letter**
   - ❌ **Temporary password expiration** (uncheck)

2. **Multi-factor authentication (MFA)**:
   - Select **"No MFA"** (for simplicity)
   - *Note: Can be enabled later for enhanced security*

3. **User account recovery**:
   - ❌ **Enable self-service account recovery** (uncheck)
   - *Note: Since we're not using email/phone verification*

### 1.4 Configure Sign-up Experience
1. **Self-service sign-up**:
   - ✅ **Enable self-registration**

2. **Attribute verification and user account confirmation**:
   - ❌ **Send email verification** (uncheck)
   - ❌ **Send SMS verification** (uncheck)
   - **No verification required**

3. **Required attributes**:
   - ✅ **preferred_username** (this will store the TikTok handle)
   - ❌ Remove any other required attributes

4. **Custom attributes**: None needed for basic setup

### 1.5 Configure Message Delivery
1. **Email provider**: Select **"Send email with Cognito"**
   - *Note: This is fine since we're not sending verification emails*

### 1.6 Integrate Your App
1. **User pool name**: `tiktok-commerce-users-production`
2. **App client name**: `tiktok-commerce-client`
3. **Client secret**: ❌ **Don't generate a client secret**
4. **Authentication flows**:
   - ✅ **ALLOW_USER_PASSWORD_AUTH**
   - ✅ **ALLOW_REFRESH_TOKEN_AUTH**
   - ❌ **ALLOW_USER_SRP_AUTH** (uncheck)
   - ❌ **ALLOW_CUSTOM_AUTH** (uncheck)

## Step 2: Configure App Client Settings

### 2.1 Update App Client
1. Go to your User Pool
2. Navigate to **"App integration"** tab
3. Click on your app client
4. Click **"Edit"**

### 2.2 Authentication Flow Configuration
Ensure the following authentication flows are enabled:
- ✅ **ALLOW_USER_PASSWORD_AUTH**
- ✅ **ALLOW_REFRESH_TOKEN_AUTH**
- ❌ **ALLOW_USER_SRP_AUTH**
- ❌ **ALLOW_CUSTOM_AUTH**

### 2.3 Token Expiration Settings
- **Access token expiration**: 60 minutes
- **ID token expiration**: 60 minutes  
- **Refresh token expiration**: 30 days

### 2.4 Read and Write Attributes
**Readable attributes**:
- ✅ preferred_username
- ✅ sub

**Writable attributes**:
- ✅ preferred_username

## Step 3: Environment Configuration

### 3.1 Collect Required Information
After creating the User Pool, collect these values:

```bash
# From User Pool General Settings
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX

# From App Client Settings  
COGNITO_CLIENT_ID=your-client-id-here

# AWS Region
AWS_REGION=us-east-1
```

### 3.2 Update Environment Variables
Add these to your `.env.production` file:

```env
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id-here
COGNITO_REGION=us-east-1

# Authentication Flow Configuration
COGNITO_AUTH_FLOW=USER_PASSWORD_AUTH
COGNITO_USERNAME_ATTRIBUTE=preferred_username

# Password Policy (optional - for frontend validation)
COGNITO_PASSWORD_MIN_LENGTH=8
COGNITO_REQUIRE_UPPERCASE=true
COGNITO_REQUIRE_LOWERCASE=true
COGNITO_REQUIRE_NUMBERS=true
COGNITO_REQUIRE_SYMBOLS=true
```

## Step 4: IAM Permissions

### 4.1 Create IAM Policy
Create an IAM policy for your application with these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cognito-idp:SignUp",
                "cognito-idp:InitiateAuth",
                "cognito-idp:RespondToAuthChallenge",
                "cognito-idp:GetUser",
                "cognito-idp:GlobalSignOut"
            ],
            "Resource": "arn:aws:cognito-idp:us-east-1:YOUR-ACCOUNT-ID:userpool/us-east-1_XXXXXXXXX"
        }
    ]
}
```

### 4.2 Attach Policy to Role
1. Create or use existing IAM role for your application
2. Attach the policy created above
3. Ensure your application uses this role (via EC2 instance profile, ECS task role, etc.)

## Step 5: Testing Configuration

### 5.1 Test User Creation
Use AWS CLI to test user creation:

```bash
aws cognito-idp sign-up \
  --client-id YOUR_CLIENT_ID \
  --username test-handle \
  --password "TestPass123!" \
  --user-attributes Name=preferred_username,Value=test-handle
```

### 5.2 Test Authentication
```bash
aws cognito-idp initiate-auth \
  --client-id YOUR_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=test-handle,PASSWORD="TestPass123!"
```

## Step 6: Security Considerations

### 6.1 Production Security Settings
For production environments, consider:

1. **Enable MFA** for enhanced security
2. **Set up CloudTrail** for audit logging
3. **Configure rate limiting** in your application
4. **Use HTTPS only** for all communications
5. **Implement proper CORS** settings

### 6.2 Monitoring and Alerts
Set up CloudWatch alarms for:
- Failed authentication attempts
- Unusual sign-up patterns
- Token refresh failures

## Step 7: Troubleshooting

### Common Issues

**Issue**: `NotAuthorizedException: Incorrect username or password`
- **Solution**: Verify the username format and ensure USER_PASSWORD_AUTH is enabled

**Issue**: `InvalidParameterException: Cannot read property 'challenge' of null`
- **Solution**: Ensure no MFA or email verification is required

**Issue**: `UserNotConfirmedException: User is not confirmed`
- **Solution**: Disable email/SMS verification in User Pool settings

### Debug Commands

Check User Pool configuration:
```bash
aws cognito-idp describe-user-pool --user-pool-id us-east-1_XXXXXXXXX
```

Check App Client configuration:
```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-id YOUR_CLIENT_ID
```

## Step 8: Terraform Configuration (Optional)

If using Terraform, here's the configuration:

```hcl
resource "aws_cognito_user_pool" "tiktok_commerce" {
  name = "tiktok-commerce-users-production"

  username_attributes = ["preferred_username"]
  
  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  auto_verified_attributes = []
  
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  schema {
    attribute_data_type = "String"
    name               = "preferred_username"
    required           = true
    mutable           = true
  }
}

resource "aws_cognito_user_pool_client" "tiktok_commerce_client" {
  name         = "tiktok-commerce-client"
  user_pool_id = aws_cognito_user_pool.tiktok_commerce.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  access_token_validity  = 60
  id_token_validity     = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  read_attributes  = ["preferred_username", "sub"]
  write_attributes = ["preferred_username"]
}
```

## Conclusion

After completing these steps, your AWS Cognito User Pool will be configured to support password-based authentication with TikTok handles as usernames. The application can now use the `USER_PASSWORD_AUTH` flow for secure user authentication.
