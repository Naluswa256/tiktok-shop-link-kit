# SQL vs DynamoDB: Complete Comparison

This document provides a side-by-side comparison of how the same data operations would be implemented in SQL vs DynamoDB, helping you understand the fundamental differences.

## 📊 Data Modeling Comparison

### SQL Approach (Traditional)

```sql
-- Multiple normalized tables
CREATE TABLE users (
    id UUID PRIMARY KEY,
    handle VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    profile_photo_url TEXT,
    follower_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    subscription_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    cognito_user_id VARCHAR(100),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shop_links (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    shop_url VARCHAR(200) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_handle ON users(handle);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_subscription ON users(subscription_status);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_cognito_id ON user_sessions(cognito_user_id);
```

### DynamoDB Approach (Single Table)

```typescript
// Single table with multiple entity types
interface DynamoDBItem {
  // Primary Keys
  PK: string;    // Partition Key
  SK: string;    // Sort Key
  
  // Global Secondary Index Keys
  GSI1PK: string;  // Handle lookups
  GSI1SK: string;
  GSI2PK: string;  // Phone lookups  
  GSI2SK: string;
  GSI3PK: string;  // Subscription status lookups
  GSI3SK: string;
  
  // Entity identification
  EntityType: string;
  
  // Data attributes (vary by entity type)
  [key: string]: any;
}

// User entity
{
  PK: "USER#550e8400-e29b-41d4-a716-446655440000",
  SK: "USER#550e8400-e29b-41d4-a716-446655440000",
  GSI1PK: "HANDLE#johndoe123",
  GSI1SK: "USER#550e8400-e29b-41d4-a716-446655440000",
  GSI2PK: "PHONE#+1234567890",
  GSI2SK: "USER#550e8400-e29b-41d4-a716-446655440000",
  GSI3PK: "STATUS#active",
  GSI3SK: "USER#550e8400-e29b-41d4-a716-446655440000",
  EntityType: "USER",
  userId: "550e8400-e29b-41d4-a716-446655440000",
  handle: "johndoe123",
  phoneNumber: "+1234567890",
  displayName: "John Doe",
  // ... other user attributes
}

// Session entity (related to user)
{
  PK: "USER#550e8400-e29b-41d4-a716-446655440000",
  SK: "SESSION#660f9511-f39c-52e5-b827-557766551111",
  GSI1PK: "COGNITO#us-east-1_ABC123DEF456",
  GSI1SK: "SESSION#660f9511-f39c-52e5-b827-557766551111",
  EntityType: "SESSION",
  sessionId: "660f9511-f39c-52e5-b827-557766551111",
  cognitoUserId: "us-east-1_ABC123DEF456",
  accessToken: "eyJhbGciOiJIUzI1NiIs...",
  // ... other session attributes
}
```

## 🔍 Query Comparison

### 1. Get User by ID

#### SQL
```sql
SELECT * FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

#### DynamoDB
```typescript
const result = await dynamoClient.send(
  new GetItemCommand({
    TableName: 'tiktok-users',
    Key: marshall({
      PK: 'USER#550e8400-e29b-41d4-a716-446655440000',
      SK: 'USER#550e8400-e29b-41d4-a716-446655440000'
    })
  })
);
```

### 2. Get User by Handle

#### SQL
```sql
SELECT * FROM users WHERE handle = 'johndoe123';
```

#### DynamoDB
```typescript
const result = await dynamoClient.send(
  new QueryCommand({
    TableName: 'tiktok-users',
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: marshall({
      ':gsi1pk': 'HANDLE#johndoe123'
    })
  })
);
```

### 3. Get User with Sessions (JOIN equivalent)

#### SQL
```sql
SELECT 
  u.*,
  s.access_token,
  s.expires_at
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id
WHERE u.handle = 'johndoe123'
  AND s.expires_at > NOW();
```

#### DynamoDB
```typescript
// Step 1: Get user by handle
const userResult = await dynamoClient.send(
  new QueryCommand({
    TableName: 'tiktok-users',
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: marshall({
      ':gsi1pk': 'HANDLE#johndoe123'
    })
  })
);

if (!userResult.Items?.length) return null;
const user = unmarshall(userResult.Items[0]);

// Step 2: Get user's sessions
const sessionsResult = await dynamoClient.send(
  new QueryCommand({
    TableName: 'tiktok-users',
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: '#expiresAt > :now',
    ExpressionAttributeNames: {
      '#expiresAt': 'expiresAt'
    },
    ExpressionAttributeValues: marshall({
      ':pk': `USER#${user.userId}`,
      ':sk': 'SESSION#',
      ':now': new Date().toISOString()
    })
  })
);

const sessions = sessionsResult.Items?.map(item => unmarshall(item)) || [];
return { user, sessions };
```

### 4. Complex Filtering

#### SQL
```sql
SELECT * FROM users 
WHERE subscription_status IN ('active', 'trial')
  AND follower_count > 1000
  AND is_verified = true
  AND created_at > '2024-01-01'
ORDER BY follower_count DESC
LIMIT 20;
```

#### DynamoDB
```typescript
// Option 1: Query by subscription status, then filter
const result = await dynamoClient.send(
  new QueryCommand({
    TableName: 'tiktok-users',
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :status',
    FilterExpression: '#followers > :minFollowers AND #verified = :verified AND #created > :date',
    ExpressionAttributeNames: {
      '#followers': 'followerCount',
      '#verified': 'isVerified',
      '#created': 'createdAt'
    },
    ExpressionAttributeValues: marshall({
      ':status': 'STATUS#active',
      ':minFollowers': 1000,
      ':verified': true,
      ':date': '2024-01-01T00:00:00.000Z'
    }),
    Limit: 20
  })
);

// Option 2: Scan with filters (less efficient)
const result = await dynamoClient.send(
  new ScanCommand({
    TableName: 'tiktok-users',
    FilterExpression: '(#status = :active OR #status = :trial) AND #followers > :minFollowers AND #verified = :verified AND #created > :date',
    ExpressionAttributeNames: {
      '#status': 'subscriptionStatus',
      '#followers': 'followerCount',
      '#verified': 'isVerified',
      '#created': 'createdAt'
    },
    ExpressionAttributeValues: marshall({
      ':active': 'active',
      ':trial': 'trial',
      ':minFollowers': 1000,
      ':verified': true,
      ':date': '2024-01-01T00:00:00.000Z'
    }),
    Limit: 20
  })
);
```

## 🔄 CRUD Operations Comparison

### Create Operations

#### SQL
```sql
-- Insert user
INSERT INTO users (
  id, handle, phone_number, display_name, 
  subscription_status, created_at, updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'johndoe123',
  '+1234567890',
  'John Doe',
  'pending',
  NOW(),
  NOW()
);

-- Insert related session
INSERT INTO user_sessions (
  id, user_id, cognito_user_id, access_token, expires_at, created_at
) VALUES (
  '660f9511-f39c-52e5-b827-557766551111',
  '550e8400-e29b-41d4-a716-446655440000',
  'us-east-1_ABC123DEF456',
  'eyJhbGciOiJIUzI1NiIs...',
  NOW() + INTERVAL '1 hour',
  NOW()
);
```

#### DynamoDB
```typescript
// Create user and session in batch
const items = [
  {
    PutRequest: {
      Item: marshall({
        PK: 'USER#550e8400-e29b-41d4-a716-446655440000',
        SK: 'USER#550e8400-e29b-41d4-a716-446655440000',
        GSI1PK: 'HANDLE#johndoe123',
        GSI1SK: 'USER#550e8400-e29b-41d4-a716-446655440000',
        GSI2PK: 'PHONE#+1234567890',
        GSI2SK: 'USER#550e8400-e29b-41d4-a716-446655440000',
        EntityType: 'USER',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        handle: 'johndoe123',
        phoneNumber: '+1234567890',
        displayName: 'John Doe',
        subscriptionStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
  },
  {
    PutRequest: {
      Item: marshall({
        PK: 'USER#550e8400-e29b-41d4-a716-446655440000',
        SK: 'SESSION#660f9511-f39c-52e5-b827-557766551111',
        GSI1PK: 'COGNITO#us-east-1_ABC123DEF456',
        GSI1SK: 'SESSION#660f9511-f39c-52e5-b827-557766551111',
        EntityType: 'SESSION',
        sessionId: '660f9511-f39c-52e5-b827-557766551111',
        cognitoUserId: 'us-east-1_ABC123DEF456',
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString()
      })
    }
  }
];

await dynamoClient.send(
  new BatchWriteItemCommand({
    RequestItems: {
      'tiktok-users': items
    }
  })
);
```

### Update Operations

#### SQL
```sql
-- Update user subscription
UPDATE users 
SET subscription_status = 'active',
    updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Update with conditions
UPDATE users 
SET follower_count = follower_count + 100,
    updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
  AND subscription_status = 'active';
```

#### DynamoDB
```typescript
// Update user subscription
await dynamoClient.send(
  new UpdateItemCommand({
    TableName: 'tiktok-users',
    Key: marshall({
      PK: 'USER#550e8400-e29b-41d4-a716-446655440000',
      SK: 'USER#550e8400-e29b-41d4-a716-446655440000'
    }),
    UpdateExpression: 'SET #status = :status, #updated = :updated',
    ExpressionAttributeNames: {
      '#status': 'subscriptionStatus',
      '#updated': 'updatedAt'
    },
    ExpressionAttributeValues: marshall({
      ':status': 'active',
      ':updated': new Date().toISOString()
    })
  })
);

// Conditional update with increment
await dynamoClient.send(
  new UpdateItemCommand({
    TableName: 'tiktok-users',
    Key: marshall({
      PK: 'USER#550e8400-e29b-41d4-a716-446655440000',
      SK: 'USER#550e8400-e29b-41d4-a716-446655440000'
    }),
    UpdateExpression: 'ADD #followers :increment SET #updated = :updated',
    ConditionExpression: '#status = :activeStatus',
    ExpressionAttributeNames: {
      '#followers': 'followerCount',
      '#updated': 'updatedAt',
      '#status': 'subscriptionStatus'
    },
    ExpressionAttributeValues: marshall({
      ':increment': 100,
      ':updated': new Date().toISOString(),
      ':activeStatus': 'active'
    })
  })
);
```

## 📈 Performance & Scaling Differences

### SQL Database
- **Vertical Scaling**: Upgrade CPU, RAM, storage
- **Read Replicas**: Scale reads across multiple instances
- **Sharding**: Manual partitioning across multiple databases
- **Joins**: Expensive operations across large datasets
- **ACID**: Strong consistency guarantees

### DynamoDB
- **Horizontal Scaling**: Automatic partitioning
- **Predictable Performance**: Single-digit millisecond latency
- **No Joins**: Data must be denormalized
- **Eventually Consistent**: Optimized for availability
- **Pay-per-Use**: Scales to zero when not used

## 🎯 When to Use Each

### Use SQL When:
- Complex relationships and joins are required
- ACID transactions are critical
- Ad-hoc queries and reporting are needed
- Data structure changes frequently
- Team has strong SQL expertise

### Use DynamoDB When:
- Predictable access patterns
- High scale and performance requirements
- Serverless architecture
- Cost optimization for variable workloads
- Simple key-value or document storage needs

This comparison shows how the same business logic can be implemented in both paradigms, each with their own trade-offs and optimal use cases.
