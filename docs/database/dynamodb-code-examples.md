# DynamoDB Code Examples from TikTok Commerce Link Hub

This document shows real code examples from our implementation, explaining each part in detail.

## 📁 Repository Pattern Implementation

### UserRepository Class Structure

```typescript
@Injectable()
export class UserRepository implements UserRepositoryInterface {
  private readonly logger = new Logger(UserRepository.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize DynamoDB client
    this.dynamoClient = new DynamoDBClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      // For local development with LocalStack
      ...(this.configService.get('DYNAMODB_ENDPOINT') && {
        endpoint: this.configService.get('DYNAMODB_ENDPOINT'),
      }),
    });
    
    // Get table name from environment
    this.tableName = this.configService.get('DYNAMODB_USERS_TABLE', 'tiktok-users-dev');
  }
}
```

**Key Points:**
- `@Injectable()`: NestJS dependency injection
- `DynamoDBClient`: AWS SDK v3 client (not v2)
- Environment-based configuration for local vs production
- Type-safe configuration with fallback defaults

## 🔧 Data Transformation Functions

### Marshall/Unmarshall Explained

```typescript
// JavaScript object
const user = {
  userId: "123",
  handle: "john",
  followerCount: 1000,
  isVerified: true,
  tags: ["influencer", "tech"],
  metadata: {
    lastLogin: "2024-01-15T10:30:00.000Z",
    preferences: { theme: "dark" }
  }
};

// After marshall() - DynamoDB format
{
  "userId": { "S": "123" },
  "handle": { "S": "john" },
  "followerCount": { "N": "1000" },
  "isVerified": { "BOOL": true },
  "tags": { "SS": ["influencer", "tech"] },
  "metadata": {
    "M": {
      "lastLogin": { "S": "2024-01-15T10:30:00.000Z" },
      "preferences": { "M": { "theme": { "S": "dark" } } }
    }
  }
}

// Our code handles this automatically:
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoFormat = marshall(user);      // JS → DynamoDB
const jsFormat = unmarshall(dynamoFormat); // DynamoDB → JS
```

### Type Mapping Function

```typescript
private mapDynamoItemToUser(item: UserDynamoDBItem): User {
  return {
    // Required fields
    userId: item.userId,
    handle: item.handle,
    phoneNumber: item.phoneNumber,
    shopLink: item.shopLink,
    subscriptionStatus: item.subscriptionStatus as SubscriptionStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    
    // Optional fields with safe access
    profilePhotoUrl: item.profilePhotoUrl || undefined,
    displayName: item.displayName || undefined,
    followerCount: item.followerCount || 0,
    isVerified: item.isVerified || false,
    cognitoUserId: item.cognitoUserId || undefined,
    trialStartDate: item.trialStartDate || undefined,
    trialEndDate: item.trialEndDate || undefined,
    subscriptionStartDate: item.subscriptionStartDate || undefined,
    subscriptionEndDate: item.subscriptionEndDate || undefined,
    lastLoginAt: item.lastLoginAt || undefined,
  };
}
```

## 📝 Create Operation Deep Dive

```typescript
async createUser(userData: CreateUserInput): Promise<User> {
  // 1. Generate unique identifiers
  const userId = uuidv4();
  const now = new Date().toISOString();
  const shopLink = `/shop/${userData.handle}`;

  // 2. Build the complete user object
  const user: User = {
    userId,
    handle: userData.handle,
    phoneNumber: userData.phoneNumber,
    shopLink,
    subscriptionStatus: SubscriptionStatus.PENDING,
    profilePhotoUrl: userData.profilePhotoUrl,
    displayName: userData.displayName,
    followerCount: userData.followerCount,
    isVerified: userData.isVerified,
    cognitoUserId: userData.cognitoUserId,
    createdAt: now,
    updatedAt: now,
  };

  // 3. Transform to DynamoDB item with all access patterns
  const dynamoItem: UserDynamoDBItem = {
    // Primary key pattern
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,
    
    // GSI1: Handle lookup pattern
    GSI1PK: `HANDLE#${userData.handle}`,
    GSI1SK: `USER#${userId}`,
    
    // GSI2: Phone lookup pattern
    GSI2PK: `PHONE#${userData.phoneNumber}`,
    GSI2SK: `USER#${userId}`,
    
    // Entity type for filtering
    EntityType: 'USER',
    
    // Spread all user data
    ...user,
  };

  try {
    // 4. Write to DynamoDB with condition
    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(dynamoItem),
        // Prevent overwriting existing users
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );

    this.logger.log(`User created successfully: ${userId}`);
    return user;
    
  } catch (error) {
    // 5. Handle specific DynamoDB errors
    if (error instanceof ConditionalCheckFailedException) {
      this.logger.error(`User already exists: ${userId}`);
      throw new Error('User already exists');
    }
    this.logger.error(`Failed to create user: ${userId}`, error);
    throw error;
  }
}
```

**Key Concepts Explained:**

1. **UUID Generation**: Ensures globally unique identifiers
2. **ISO Timestamps**: Consistent date format across all items
3. **Key Patterns**: Structured keys enable efficient queries
4. **GSI Design**: Multiple access patterns in single table
5. **Conditional Writes**: Prevent race conditions and duplicates
6. **Error Handling**: Specific handling for DynamoDB exceptions

## 🔍 Query Operations Breakdown

### Simple Get by Primary Key

```typescript
async getUserById(userId: string): Promise<User | null> {
  try {
    // Most efficient operation - direct key lookup
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${userId}`,
          SK: `USER#${userId}`,
        }),
        // Optional: only return specific attributes
        // ProjectionExpression: 'userId, handle, subscriptionStatus'
      })
    );

    // Handle not found case
    if (!result.Item) {
      return null;
    }

    // Transform back to application format
    const item = unmarshall(result.Item) as UserDynamoDBItem;
    return this.mapDynamoItemToUser(item);
    
  } catch (error) {
    this.logger.error(`Failed to get user by ID: ${userId}`, error);
    throw error;
  }
}
```

### Query with GSI (Secondary Access Pattern)

```typescript
async getUserByHandle(handle: string): Promise<User | null> {
  try {
    // Query using Global Secondary Index
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',  // Handle lookup index
        
        // Key condition - must use exact match on partition key
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: marshall({
          ':gsi1pk': `HANDLE#${handle}`,
        }),
        
        // Limit results (handles should be unique)
        Limit: 1,
        
        // Optional: scan forward or backward
        ScanIndexForward: true,
      })
    );

    // Check if any items found
    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    // Transform first result
    const item = unmarshall(result.Items[0]) as UserDynamoDBItem;
    return this.mapDynamoItemToUser(item);
    
  } catch (error) {
    this.logger.error(`Failed to get user by handle: ${handle}`, error);
    throw error;
  }
}
```

## ✏️ Update Operations with Expressions

### Dynamic Update Builder

```typescript
async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
  const now = new Date().toISOString();
  
  // Build update expression dynamically
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Process each update field
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  });

  // Always update timestamp
  updateExpression.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = now;

  try {
    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${userId}`,
          SK: `USER#${userId}`,
        }),
        
        // Dynamic update expression
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        
        // Ensure item exists before updating
        ConditionExpression: 'attribute_exists(PK)',
        
        // Optional: return updated values
        ReturnValues: 'ALL_NEW',
      })
    );

    this.logger.log(`User updated successfully: ${userId}`);
    
    // Fetch and return updated user
    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }
    
    return updatedUser;
    
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      this.logger.error(`User not found for update: ${userId}`);
      throw new Error('User not found');
    }
    this.logger.error(`Failed to update user: ${userId}`, error);
    throw error;
  }
}
```

**Expression Syntax Explained:**

- `#fieldName`: Attribute name placeholder (handles reserved words)
- `:value`: Attribute value placeholder (prevents injection)
- `SET`: Updates or adds attributes
- `ADD`: Increments numbers or adds to sets
- `REMOVE`: Deletes attributes
- `DELETE`: Removes elements from sets

## 🔍 Complex Query with Filtering

```typescript
async findUsers(filters: UserFilters, limit: number = 20): Promise<User[]> {
  try {
    let command: QueryCommand;

    // Strategy 1: Use GSI if we have a key condition
    if (filters.handle) {
      command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: marshall({
          ':gsi1pk': `HANDLE#${filters.handle}`,
        }),
        Limit: limit,
      });
      
    } else if (filters.phoneNumber) {
      command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: marshall({
          ':gsi2pk': `PHONE#${filters.phoneNumber}`,
        }),
        Limit: limit,
      });
      
    } else {
      // Strategy 2: Scan with filters (less efficient)
      const filterExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      // Build filter conditions
      if (filters.subscriptionStatus) {
        filterExpressions.push('#status = :status');
        expressionAttributeNames['#status'] = 'subscriptionStatus';
        expressionAttributeValues[':status'] = filters.subscriptionStatus;
      }

      if (filters.cognitoUserId) {
        filterExpressions.push('#cognitoId = :cognitoId');
        expressionAttributeNames['#cognitoId'] = 'cognitoUserId';
        expressionAttributeValues[':cognitoId'] = filters.cognitoUserId;
      }

      // Only scan if we have filters
      if (filterExpressions.length === 0) {
        return []; // Prevent full table scan
      }

      command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: filterExpressions.join(' AND '),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        Limit: limit,
      });
    }

    const result = await this.dynamoClient.send(command);
    
    if (!result.Items) {
      return [];
    }

    // Transform all results
    return result.Items.map(item => 
      this.mapDynamoItemToUser(unmarshall(item) as UserDynamoDBItem)
    );
    
  } catch (error) {
    this.logger.error('Failed to find users', error);
    throw error;
  }
}
```

## 🔄 Batch Operations

### Batch Read (Multiple Users)

```typescript
async batchGetUsers(userIds: string[]): Promise<User[]> {
  // DynamoDB batch limit is 100 items
  const chunks = this.chunkArray(userIds, 100);
  const results = [];

  for (const chunk of chunks) {
    try {
      const params = {
        RequestItems: {
          [this.tableName]: {
            Keys: chunk.map(id => marshall({
              PK: `USER#${id}`,
              SK: `USER#${id}`,
            })),
            // Optional: specify which attributes to return
            ProjectionExpression: 'userId, handle, subscriptionStatus, createdAt'
          }
        }
      };

      const result = await this.dynamoClient.send(
        new BatchGetItemCommand(params)
      );

      if (result.Responses && result.Responses[this.tableName]) {
        results.push(...result.Responses[this.tableName]);
      }

      // Handle unprocessed keys (rare, but possible)
      if (result.UnprocessedKeys && Object.keys(result.UnprocessedKeys).length > 0) {
        this.logger.warn('Some keys were not processed in batch get');
        // Could implement retry logic here
      }
      
    } catch (error) {
      this.logger.error(`Batch get failed for chunk: ${chunk}`, error);
      throw error;
    }
  }

  // Transform all results
  return results.map(item => 
    this.mapDynamoItemToUser(unmarshall(item) as UserDynamoDBItem)
  );
}

// Utility function for chunking arrays
private chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

This code demonstrates the practical implementation of DynamoDB operations, showing how to handle the complexities of NoSQL data access while maintaining type safety and error handling.
