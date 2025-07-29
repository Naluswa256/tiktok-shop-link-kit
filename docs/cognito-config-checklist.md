# AWS Cognito Configuration Checklist

## Quick Setup Checklist

### ✅ User Pool Configuration
- [ ] **Authentication providers**: Cognito user pool only
- [ ] **Sign-in options**: Username only (no email/phone)
- [ ] **Username requirements**: Allow preferred username
- [ ] **Case sensitivity**: Disabled
- [ ] **Password policy**: 8+ chars, uppercase, lowercase, numbers, symbols
- [ ] **MFA**: Disabled (for simplicity)
- [ ] **Account recovery**: Disabled
- [ ] **Self-registration**: Enabled
- [ ] **Email/SMS verification**: Disabled
- [ ] **Required attributes**: preferred_username only

### ✅ App Client Configuration
- [ ] **Client secret**: Not generated
- [ ] **Authentication flows**:
  - [ ] ✅ ALLOW_USER_PASSWORD_AUTH
  - [ ] ✅ ALLOW_REFRESH_TOKEN_AUTH
  - [ ] ❌ ALLOW_USER_SRP_AUTH
  - [ ] ❌ ALLOW_CUSTOM_AUTH
- [ ] **Token expiration**:
  - [ ] Access token: 60 minutes
  - [ ] ID token: 60 minutes
  - [ ] Refresh token: 30 days
- [ ] **Read attributes**: preferred_username, sub
- [ ] **Write attributes**: preferred_username

### ✅ Environment Variables
```env
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id-here
COGNITO_REGION=us-east-1
COGNITO_AUTH_FLOW=USER_PASSWORD_AUTH
COGNITO_USERNAME_ATTRIBUTE=preferred_username
```

### ✅ IAM Permissions
Required actions for application role:
- [ ] cognito-idp:SignUp
- [ ] cognito-idp:InitiateAuth
- [ ] cognito-idp:RespondToAuthChallenge
- [ ] cognito-idp:GetUser
- [ ] cognito-idp:GlobalSignOut

### ✅ Testing Commands
```bash
# Test signup
aws cognito-idp sign-up \
  --client-id YOUR_CLIENT_ID \
  --username test-handle \
  --password "TestPass123!" \
  --user-attributes Name=preferred_username,Value=test-handle

# Test signin
aws cognito-idp initiate-auth \
  --client-id YOUR_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=test-handle,PASSWORD="TestPass123!"
```

## Common Configuration Mistakes

### ❌ Wrong Authentication Flow
**Problem**: Using SRP or Custom Auth instead of USER_PASSWORD_AUTH
**Solution**: Enable only USER_PASSWORD_AUTH and REFRESH_TOKEN_AUTH

### ❌ Email/SMS Verification Enabled
**Problem**: Users get stuck in unconfirmed state
**Solution**: Disable all verification methods

### ❌ Required Attributes
**Problem**: Too many required attributes causing signup failures
**Solution**: Only require preferred_username

### ❌ Client Secret Generated
**Problem**: Frontend apps can't securely store client secrets
**Solution**: Don't generate client secret for public clients

### ❌ Case Sensitive Usernames
**Problem**: Users can't sign in due to case mismatches
**Solution**: Disable case sensitivity

## Validation Steps

### 1. User Pool Settings
```bash
aws cognito-idp describe-user-pool --user-pool-id YOUR_POOL_ID
```
Verify:
- `UsernameAttributes: ["preferred_username"]`
- `Policies.PasswordPolicy` matches requirements
- `AutoVerifiedAttributes: []` (empty)

### 2. App Client Settings
```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID
```
Verify:
- `GenerateSecret: false`
- `ExplicitAuthFlows` contains only USER_PASSWORD_AUTH and REFRESH_TOKEN_AUTH
- `ReadAttributes` and `WriteAttributes` are correct

### 3. Test Authentication Flow
1. Create test user via API
2. Authenticate with username/password
3. Verify JWT token structure
4. Test token refresh
5. Test sign out

## Security Recommendations

### Production Settings
- [ ] Enable CloudTrail for audit logging
- [ ] Set up CloudWatch alarms for failed auth attempts
- [ ] Implement rate limiting in application
- [ ] Use HTTPS only
- [ ] Configure proper CORS settings
- [ ] Consider enabling MFA for admin users

### Monitoring Metrics
- [ ] SignUp attempts
- [ ] SignIn success/failure rates
- [ ] Token refresh patterns
- [ ] Unusual activity alerts

## Troubleshooting Guide

### Error: "NotAuthorizedException"
- Check username format
- Verify password meets policy
- Ensure USER_PASSWORD_AUTH is enabled

### Error: "UserNotConfirmedException"
- Disable email/SMS verification
- Check auto-verified attributes

### Error: "InvalidParameterException"
- Verify required attributes
- Check authentication flow configuration

### Error: "ResourceNotFoundException"
- Verify User Pool ID and Client ID
- Check AWS region configuration
