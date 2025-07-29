# TikTok Commerce Authentication API - Curl Test Commands

## Configuration
```bash
export BASE_URL="http://localhost:3001"
export API_BASE="$BASE_URL/auth"
```

## 1. Handle Validation Tests

### ✅ Validate Existing TikTok Handle
```bash
curl -X POST "$API_BASE/validate-handle" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "charlidamelio"
  }' | jq
```

### ❌ Validate Non-existent Handle
```bash
curl -X POST "$API_BASE/validate-handle" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "nonexistent-handle-12345"
  }' | jq
```

### ❌ Invalid Handle Format
```bash
curl -X POST "$API_BASE/validate-handle" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "invalid@handle!"
  }' | jq
```

## 2. Password-Based Signup Tests

### ✅ Valid Signup
```bash
curl -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "test-user-123",
    "password": "SecurePass123!"
  }' | jq
```

### ❌ Weak Password
```bash
curl -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "test-user-456",
    "password": "123"
  }' | jq
```

### ❌ Missing Password
```bash
curl -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "test-user-789"
  }' | jq
```

### ❌ Invalid Handle Format
```bash
curl -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "invalid@handle!",
    "password": "SecurePass123!"
  }' | jq
```

## 3. Password-Based Signin Tests

### ✅ Valid Signin
```bash
curl -X POST "$API_BASE/password/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "test-user-123",
    "password": "SecurePass123!"
  }' | jq
```

### ❌ Wrong Password
```bash
curl -X POST "$API_BASE/password/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "test-user-123",
    "password": "WrongPassword123!"
  }' | jq
```

### ❌ Non-existent User
```bash
curl -X POST "$API_BASE/password/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "nonexistent-user",
    "password": "SecurePass123!"
  }' | jq
```

## 4. Token Management Tests

### ✅ Refresh Token (use refresh token from signin response)
```bash
export REFRESH_TOKEN="your-refresh-token-here"

curl -X POST "$API_BASE/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }' | jq
```

### ❌ Invalid Refresh Token
```bash
curl -X POST "$API_BASE/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "invalid.refresh.token"
  }' | jq
```

## 5. Protected Endpoint Tests

### ✅ Get Current User (use access token from signin response)
```bash
export ACCESS_TOKEN="your-access-token-here"

curl -X GET "$API_BASE/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### ❌ Get Current User (no token)
```bash
curl -X GET "$API_BASE/me" \
  -H "Content-Type: application/json" | jq
```

### ❌ Get Current User (invalid token)
```bash
curl -X GET "$API_BASE/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid.jwt.token" | jq
```

### ✅ Sign Out
```bash
curl -X POST "$API_BASE/signout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

## 6. Complete Test Flow

### Step 1: Validate Handle
```bash
curl -X POST "$API_BASE/validate-handle" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "your-tiktok-handle"
  }' | jq
```

### Step 2: Signup
```bash
SIGNUP_RESPONSE=$(curl -s -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "your-tiktok-handle",
    "password": "YourSecurePassword123!"
  }')

echo $SIGNUP_RESPONSE | jq
```

### Step 3: Signin and Extract Tokens
```bash
SIGNIN_RESPONSE=$(curl -s -X POST "$API_BASE/password/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "your-tiktok-handle",
    "password": "YourSecurePassword123!"
  }')

echo $SIGNIN_RESPONSE | jq

# Extract tokens
export ACCESS_TOKEN=$(echo $SIGNIN_RESPONSE | jq -r '.data.accessToken')
export REFRESH_TOKEN=$(echo $SIGNIN_RESPONSE | jq -r '.data.refreshToken')

echo "Access Token: $ACCESS_TOKEN"
echo "Refresh Token: $REFRESH_TOKEN"
```

### Step 4: Access Protected Endpoint
```bash
curl -X GET "$API_BASE/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### Step 5: Refresh Token
```bash
REFRESH_RESPONSE=$(curl -s -X POST "$API_BASE/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }')

echo $REFRESH_RESPONSE | jq

# Update access token
export ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | jq -r '.data.accessToken')
```

### Step 6: Sign Out
```bash
curl -X POST "$API_BASE/signout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

## 7. Error Testing

### Malformed JSON
```bash
curl -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{invalid json' | jq
```

### Empty Body
```bash
curl -X POST "$API_BASE/password/signup" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

### Very Long Handle
```bash
curl -X POST "$API_BASE/validate-handle" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "verylonghandlethatexceedsmaximumlengthallowed"
  }' | jq
```

## Expected Response Formats

### Successful Signup Response
```json
{
  "success": true,
  "data": {
    "success": true,
    "shopLink": "/shop/your-handle",
    "message": "Account created successfully! Your shop is ready."
  },
  "message": "Account created successfully! Your shop is ready."
}
```

### Successful Signin Response
```json
{
  "success": true,
  "data": {
    "success": true,
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJjdHkiOiJKV1QiLCJlbmMi...",
    "idToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 3600,
    "user": {
      "handle": "your-handle",
      "userId": "uuid-here",
      "subscriptionStatus": "trial"
    }
  },
  "message": "Authentication successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid handle or password"
  },
  "message": "Invalid handle or password"
}
```

## Notes

1. **Replace placeholders**: Update `your-tiktok-handle` with a real TikTok handle
2. **Server must be running**: Ensure your NestJS server is running on `http://localhost:3001`
3. **Handle validation**: Some tests may fail if the TikTok handle doesn't exist
4. **Token expiration**: Access tokens expire, so refresh them as needed
5. **Environment**: These commands assume a local development environment
