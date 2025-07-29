# AWS Cognito Client Secret Configuration

## Overview

AWS Cognito supports two types of app clients:
1. **Public clients** - No client secret (for mobile apps, SPAs)
2. **Confidential clients** - With client secret (for server-side applications)

When your Cognito app client has a client secret configured, you **MUST** include a `SECRET_HASH` parameter in all authentication API calls. This is a security requirement enforced by AWS Cognito.

## When is SECRET_HASH Required?

The `SECRET_HASH` parameter is required for these Cognito API operations when your app client has a client secret:

### Authentication Parameters (in `AuthParameters`)
- `InitiateAuth`
- `AdminInitiateAuth`

### Challenge Responses (in `ChallengeResponses`)
- `RespondToAuthChallenge`
- `AdminRespondToAuthChallenge`

### Direct Parameters
- `SignUp` (as `SecretHash`)
- `ConfirmSignUp` (as `SecretHash`)
- `ForgotPassword` (as `SecretHash`)
- `ConfirmForgotPassword` (as `SecretHash`)
- `ResendConfirmationCode` (as `SecretHash`)

## SECRET_HASH Calculation

The SECRET_HASH is calculated using this formula:
```
Base64(HMAC_SHA256("Client Secret Key", "Username" + "Client Id"))
```

### Implementation in Our Service

Our `AuthService` automatically calculates and includes the SECRET_HASH when needed:

```typescript
private calculateSecretHash(username: string): string | undefined {
  if (!this.clientSecret) {
    return undefined; // No secret hash needed for public clients
  }

  const message = username + this.clientId;
  const hmac = crypto.createHmac('sha256', this.clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
}
```

## Configuration

### Environment Variables

Add the client secret to your environment configuration:

```bash
# Required for all clients
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-cognito-client-id

# Required only if your app client has a secret configured
COGNITO_CLIENT_SECRET=your-cognito-client-secret
```

### Getting Your Client Secret

1. Go to AWS Cognito Console
2. Select your User Pool
3. Go to "App integration" → "App clients"
4. Select your app client
5. Click "Show Details" to reveal the client secret

## Error Messages

If you have a client secret configured but don't include SECRET_HASH, you'll get:
```
Unable to verify secret hash for client <client-id>
```

## Best Practices

### For Server-Side Applications (Recommended)
- Use confidential clients with client secrets
- Store client secret securely (environment variables, AWS Secrets Manager)
- Never expose client secret in client-side code

### For Client-Side Applications
- Use public clients without client secrets
- Suitable for mobile apps, SPAs where secrets cannot be kept secure

## Migration Guide

If you're migrating from a public client to a confidential client:

1. **Update Cognito App Client**:
   - Generate a client secret in AWS Console
   - Note down the secret securely

2. **Update Environment Configuration**:
   ```bash
   COGNITO_CLIENT_SECRET=your-new-client-secret
   ```

3. **Deploy Updated Service**:
   - Our service automatically detects the presence of client secret
   - SECRET_HASH will be calculated and included automatically

4. **Test Authentication**:
   - Verify signup, signin, and token refresh work correctly
   - Check logs for any "Unable to verify secret hash" errors

## Troubleshooting

### Common Issues

1. **"Unable to verify secret hash for client"**
   - Ensure `COGNITO_CLIENT_SECRET` is set correctly
   - Verify the secret matches what's configured in AWS Console
   - Check that SECRET_HASH is being calculated with correct username

2. **Authentication works without SECRET_HASH**
   - Your app client is configured as public (no secret)
   - This is fine for client-side applications

3. **SECRET_HASH mismatch**
   - Verify username format (should match what you use for signup)
   - Ensure client ID and secret are correct
   - Check for any encoding issues

### Debug Mode

Enable debug logging to see SECRET_HASH calculation:

```bash
LOG_LEVEL=debug
```

This will log (without exposing secrets):
- Whether client secret is configured
- Whether SECRET_HASH is being calculated
- Authentication flow details

## Security Considerations

1. **Never log the actual client secret or SECRET_HASH values**
2. **Store client secret in secure environment variables**
3. **Use AWS Secrets Manager for production environments**
4. **Rotate client secrets periodically**
5. **Monitor for authentication failures that might indicate secret compromise**

## References

- [AWS Cognito Authentication Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication.html)
- [Computing Secret Hash Values](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html#cognito-user-pools-computing-secret-hash)
- [AWS Knowledge Center: Unable to verify secret hash](https://repost.aws/knowledge-center/cognito-unable-to-verify-secret-hash)
