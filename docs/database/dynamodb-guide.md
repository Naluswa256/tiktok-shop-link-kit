# AWS DynamoDB Complete Guide

This document provides a comprehensive explanation of AWS DynamoDB concepts, schema design, access patterns, and implementation details used in the TikTok Commerce Link Hub.

## 📋 Table of Contents

- [DynamoDB Fundamentals](#dynamodb-fundamentals)
- [Schema Design Concepts](#schema-design-concepts)
- [Access Patterns Explained](#access-patterns-explained)
- [Table Structure & Relations](#table-structure--relations)
- [CRUD Operations](#crud-operations)
- [Code Implementation Analysis](#code-implementation-analysis)
- [Best Practices](#best-practices)

## 🔍 DynamoDB Fundamentals

### What is DynamoDB?

DynamoDB is a **NoSQL database** that differs fundamentally from traditional relational databases:

```
Traditional SQL Database:
┌─────────────────┐
│ Fixed Schema    │ ← Columns defined upfront
│ ACID Properties │ ← Strong consistency
│ SQL Queries     │ ← Complex joins possible
│ Vertical Scale  │ ← Scale by upgrading hardware
└─────────────────┘

DynamoDB (NoSQL):
┌─────────────────┐
│ Flexible Schema │ ← Items can have different attributes
│ Eventually Cons.│ ← Optimized for performance
│ Key-Value Access│ ← Access by primary key
│ Horizontal Scale│ ← Scale by adding partitions
└─────────────────┘
```

### Key Concepts

#### 1. **Tables** (Similar to SQL tables)
- Container for items
- No fixed schema
- Defined by primary key structure

#### 2. **Items** (Similar to SQL rows)
- Individual records in a table
- Can have different attributes
- Maximum size: 400KB

#### 3. **Attributes** (Similar to SQL columns)
- Key-value pairs within items
- Can be different types: String, Number, Binary, Boolean, List, Map, Set

#### 4. **Primary Key** (Unique identifier)
- **Partition Key** (Hash Key): Determines which partition stores the item
- **Sort Key** (Range Key): Optional, sorts items within partition

## 🏗️ Schema Design Concepts

### Why "No Schema" but Still Need Design?

DynamoDB is **schemaless** for attributes but **requires careful design** for access patterns:

```typescript
// ❌ SQL Thinking (Don't do this in DynamoDB)
// Multiple tables with foreign keys
Users Table: { id, name, email }
Orders Table: { id, user_id, product_id, date }
Products Table: { id, name, price }

// ✅ DynamoDB Thinking (Single table design)
MainTable: {
  PK: "USER#123" | "ORDER#456" | "PRODUCT#789",
  SK: "USER#123" | "ORDER#456" | "PRODUCT#789",
  // ... other attributes vary by entity type
}
```

### Single Table Design Pattern

Our implementation uses **Single Table Design**:

```typescript
// All entities in one table with different access patterns
interface UserDynamoDBItem {
  PK: string;      // "USER#uuid"
  SK: string;      // "USER#uuid"
  GSI1PK: string;  // "HANDLE#tiktok_handle"
  GSI1SK: string;  // "USER#uuid"
  GSI2PK: string;  // "PHONE#+1234567890"
  GSI2SK: string;  // "USER#uuid"
  EntityType: string; // "USER"
  // ... user attributes
}
```

### Primary Key Design

```typescript
// Partition Key (PK) + Sort Key (SK) = Composite Primary Key
PK: "USER#550e8400-e29b-41d4-a716-446655440000"
SK: "USER#550e8400-e29b-41d4-a716-446655440000"

// Why this pattern?
// 1. PK determines partition (for scaling)
// 2. SK allows sorting within partition
// 3. PK + SK must be unique across table
// 4. Enables hierarchical data organization
```

## 🎯 Access Patterns Explained

### Why "Known Access Patterns" Matter

Unlike SQL where you can query any column, DynamoDB requires **predefined access patterns**:

```sql
-- ❌ SQL: Can query anything
SELECT * FROM users WHERE email = 'john@example.com';
SELECT * FROM users WHERE created_date > '2024-01-01';
SELECT * FROM users WHERE name LIKE 'John%';

-- ✅ DynamoDB: Must design for specific queries
-- Pattern 1: Get user by ID
-- Pattern 2: Get user by handle  
-- Pattern 3: Get user by phone
-- Pattern 4: List users by subscription status
```

### Our Application's Access Patterns

```typescript
// Access Pattern 1: Get user by ID
// Query: PK = "USER#uuid" AND SK = "USER#uuid"
getUserById(userId: string) {
  Key: {
    PK: `USER#${userId}`,
    SK: `USER#${userId}`
  }
}

// Access Pattern 2: Get user by TikTok handle
// Query: GSI1PK = "HANDLE#handle"
getUserByHandle(handle: string) {
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :gsi1pk',
  ExpressionAttributeValues: {
    ':gsi1pk': `HANDLE#${handle}`
  }
}

// Access Pattern 3: Get user by phone number
// Query: GSI2PK = "PHONE#+1234567890"
getUserByPhone(phoneNumber: string) {
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :gsi2pk',
  ExpressionAttributeValues: {
    ':gsi2pk': `PHONE#${phoneNumber}`
  }
}
```

### Global Secondary Indexes (GSI)

GSIs enable additional access patterns:

```typescript
// Main Table Structure
{
  PK: "USER#123",           // Partition Key
  SK: "USER#123",           // Sort Key
  GSI1PK: "HANDLE#john",    // GSI1 Partition Key
  GSI1SK: "USER#123",       // GSI1 Sort Key
  GSI2PK: "PHONE#+1234",    // GSI2 Partition Key
  GSI2SK: "USER#123",       // GSI2 Sort Key
  // ... other attributes
}

// GSI1: Handle → User lookup
// GSI2: Phone → User lookup
```

## 🔗 Table Structure & Relations

### How We Define "Relations" in DynamoDB

DynamoDB doesn't have foreign keys, but we simulate relations through **key design**:

```typescript
// ❌ SQL Relations
users: { id: 1, name: "John" }
orders: { id: 1, user_id: 1, product: "iPhone" }

// ✅ DynamoDB Relations (through key patterns)
// User entity
{
  PK: "USER#123",
  SK: "USER#123",
  EntityType: "USER",
  name: "John"
}

// Order entity (related to user)
{
  PK: "USER#123",           // Same partition as user
  SK: "ORDER#456",          // Different sort key
  EntityType: "ORDER",
  product: "iPhone"
}

// This allows querying: "Get all orders for user 123"
// Query: PK = "USER#123" AND SK begins_with "ORDER#"
```

### Our Table Schema Definition

```typescript
// Terraform table definition
resource "aws_dynamodb_table" "users" {
  name           = "tiktok-users-dev"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"    // Partition Key
  range_key      = "SK"    // Sort Key

  attribute {
    name = "PK"
    type = "S"  // String
  }

  attribute {
    name = "SK" 
    type = "S"  // String
  }

  // GSI for handle lookups
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"  // Include all attributes
  }

  // GSI for phone lookups
  global_secondary_index {
    name     = "GSI2"
    hash_key = "GSI2PK"
    range_key = "GSI2SK"
    projection_type = "ALL"
  }
}
```

## 🔧 CRUD Operations

### Create (PUT/POST)

```typescript
async createUser(userData: CreateUserInput): Promise<User> {
  const userId = uuidv4();
  const now = new Date().toISOString();
  
  const dynamoItem: UserDynamoDBItem = {
    // Primary keys
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,
    
    // GSI keys for alternative access patterns
    GSI1PK: `HANDLE#${userData.handle}`,
    GSI1SK: `USER#${userId}`,
    GSI2PK: `PHONE#${userData.phoneNumber}`,
    GSI2SK: `USER#${userId}`,
    
    // Entity identification
    EntityType: 'USER',
    
    // User data
    userId,
    handle: userData.handle,
    phoneNumber: userData.phoneNumber,
    shopLink: `/shop/${userData.handle}`,
    subscriptionStatus: SubscriptionStatus.PENDING,
    createdAt: now,
    updatedAt: now,
    // ... other attributes
  };

  await this.dynamoClient.send(
    new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(dynamoItem),  // Convert to DynamoDB format
      ConditionExpression: 'attribute_not_exists(PK)', // Prevent overwrites
    })
  );
}
```

### Read (GET)

```typescript
// Read by primary key (most efficient)
async getUserById(userId: string): Promise<User | null> {
  const result = await this.dynamoClient.send(
    new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `USER#${userId}`,
        SK: `USER#${userId}`,
      }),
    })
  );

  if (!result.Item) return null;
  
  const item = unmarshall(result.Item) as UserDynamoDBItem;
  return this.mapDynamoItemToUser(item);
}

// Read using GSI (secondary access pattern)
async getUserByHandle(handle: string): Promise<User | null> {
  const result = await this.dynamoClient.send(
    new QueryCommand({
      TableName: this.tableName,
      IndexName: 'GSI1',  // Use Global Secondary Index
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: marshall({
        ':gsi1pk': `HANDLE#${handle}`,
      }),
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) return null;
  
  const item = unmarshall(result.Items[0]) as UserDynamoDBItem;
  return this.mapDynamoItemToUser(item);
}
```

### Update (PUT/PATCH)

```typescript
async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
  const now = new Date().toISOString();
  
  // Build dynamic update expression
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Add each field to update
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

  await this.dynamoClient.send(
    new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `USER#${userId}`,
        SK: `USER#${userId}`,
      }),
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ConditionExpression: 'attribute_exists(PK)', // Ensure item exists
    })
  );

  // Return updated user
  return await this.getUserById(userId);
}
```

### Delete (DELETE)

```typescript
async deleteUser(userId: string): Promise<boolean> {
  try {
    await this.dynamoClient.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${userId}`,
          SK: `USER#${userId}`,
        }),
        ConditionExpression: 'attribute_exists(PK)', // Ensure item exists
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return false; // Item didn't exist
    }
    throw error;
  }
}
```

## 💻 Code Implementation Analysis

### Are We Using an ORM?

**No, we're using the AWS SDK directly** for several reasons:

```typescript
// ❌ We're NOT using an ORM like:
// - Mongoose (MongoDB)
// - TypeORM (SQL databases)
// - Prisma (SQL databases)

// ✅ We're using AWS SDK v3 directly:
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
```

### Why No ORM?

1. **Performance**: Direct SDK calls are faster
2. **Control**: Full control over DynamoDB features
3. **Flexibility**: Can use advanced DynamoDB features
4. **Type Safety**: Custom TypeScript interfaces

### Data Marshalling/Unmarshalling

DynamoDB stores data in a specific format that needs conversion:

```typescript
// JavaScript Object
const user = {
  userId: "123",
  handle: "john",
  followerCount: 1000,
  isVerified: true
};

// DynamoDB Format (after marshall())
{
  "userId": { "S": "123" },
  "handle": { "S": "john" },
  "followerCount": { "N": "1000" },
  "isVerified": { "BOOL": true }
}

// Our code handles this conversion:
const dynamoItem = marshall(user);        // JS → DynamoDB
const jsItem = unmarshall(dynamoItem);    // DynamoDB → JS
```

### Type Safety Implementation

```typescript
// We define TypeScript interfaces for type safety
interface User {
  userId: string;
  handle: string;
  phoneNumber: string;
  subscriptionStatus: SubscriptionStatus;
  // ... other fields
}

// DynamoDB-specific interface
interface UserDynamoDBItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  EntityType: string;
  // ... includes all User fields
}

// Mapping function for conversion
private mapDynamoItemToUser(item: UserDynamoDBItem): User {
  return {
    userId: item.userId,
    handle: item.handle,
    phoneNumber: item.phoneNumber,
    subscriptionStatus: item.subscriptionStatus as SubscriptionStatus,
    // ... map other fields
  };
}
```

## 📚 Best Practices

### 1. Key Design Patterns

```typescript
// ✅ Good: Hierarchical keys
PK: "USER#123"
SK: "PROFILE#123"

PK: "USER#123"  
SK: "ORDER#456"

// ❌ Bad: Random keys
PK: "abc123"
SK: "xyz789"
```

### 2. GSI Design

```typescript
// ✅ Good: Meaningful GSI keys
GSI1PK: "HANDLE#john"     // Query by handle
GSI2PK: "PHONE#+1234"     // Query by phone
GSI3PK: "STATUS#active"   // Query by status

// ❌ Bad: Copying main table keys
GSI1PK: "USER#123"        // Same as main PK
```

### 3. Attribute Naming

```typescript
// ✅ Good: Consistent naming
{
  PK: "USER#123",
  SK: "USER#123", 
  EntityType: "USER",
  createdAt: "2024-01-15T10:30:00.000Z",
  updatedAt: "2024-01-15T10:30:00.000Z"
}

// ❌ Bad: Inconsistent naming
{
  pk: "user123",
  sortKey: "user123",
  type: "user",
  created: "2024-01-15",
  last_updated: 1705312200
}
```

### 4. Error Handling

```typescript
// ✅ Good: Handle specific DynamoDB errors
try {
  await this.dynamoClient.send(command);
} catch (error) {
  if (error instanceof ConditionalCheckFailedException) {
    throw new Error('Item already exists');
  }
  if (error instanceof ResourceNotFoundException) {
    throw new Error('Table not found');
  }
  throw error; // Re-throw unknown errors
}
```

## 🔬 Advanced DynamoDB Concepts

### Expression Syntax Deep Dive

DynamoDB uses special expression syntax for queries and updates:

#### Condition Expressions
```typescript
// Prevent overwrites
ConditionExpression: 'attribute_not_exists(PK)'

// Check current value
ConditionExpression: 'subscriptionStatus = :currentStatus'

// Multiple conditions
ConditionExpression: 'attribute_exists(PK) AND #status <> :expiredStatus'
```

#### Update Expressions
```typescript
// SET: Add or update attributes
UpdateExpression: 'SET #name = :name, #email = :email, #updatedAt = :now'

// ADD: Increment numbers or add to sets
UpdateExpression: 'ADD #loginCount :increment, #tags :newTags'

// REMOVE: Delete attributes
UpdateExpression: 'REMOVE #temporaryField, #oldData'

// Combined operations
UpdateExpression: 'SET #status = :status ADD #loginCount :inc REMOVE #tempData'
```

#### Filter Expressions
```typescript
// Filter results after query
FilterExpression: '#subscriptionStatus = :active AND #createdAt > :date'

// Complex filters
FilterExpression: '(#status = :active OR #status = :trial) AND #followerCount > :minFollowers'
```

### Projection Expressions
```typescript
// Only return specific attributes
ProjectionExpression: '#userId, #handle, #subscriptionStatus'

// Nested attributes
ProjectionExpression: '#profile.#displayName, #settings.#theme'
```

### Attribute Name/Value Substitution

```typescript
// Why use substitution?
// 1. Reserved words (status, name, etc.)
// 2. Special characters in names
// 3. Prevent injection attacks

// ❌ Direct (can break with reserved words)
KeyConditionExpression: 'status = "active"'

// ✅ With substitution
KeyConditionExpression: '#status = :statusValue'
ExpressionAttributeNames: { '#status': 'status' }
ExpressionAttributeValues: { ':statusValue': 'active' }
```

### Pagination and Limits

```typescript
// Basic pagination
const result = await this.dynamoClient.send(
  new QueryCommand({
    TableName: this.tableName,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: marshall({ ':pk': 'USER#123' }),
    Limit: 20,  // Max items per page
    ExclusiveStartKey: lastEvaluatedKey  // From previous page
  })
);

// Handle pagination
let allItems = [];
let lastKey = undefined;

do {
  const result = await query({
    ExclusiveStartKey: lastKey,
    Limit: 100
  });

  allItems.push(...result.Items);
  lastKey = result.LastEvaluatedKey;
} while (lastKey);
```

### Batch Operations

```typescript
// Batch read (up to 100 items)
async batchGetUsers(userIds: string[]): Promise<User[]> {
  const chunks = this.chunkArray(userIds, 100);
  const results = [];

  for (const chunk of chunks) {
    const params = {
      RequestItems: {
        [this.tableName]: {
          Keys: chunk.map(id => marshall({
            PK: `USER#${id}`,
            SK: `USER#${id}`
          }))
        }
      }
    };

    const result = await this.dynamoClient.send(
      new BatchGetItemCommand(params)
    );

    results.push(...result.Responses[this.tableName]);
  }

  return results.map(item =>
    this.mapDynamoItemToUser(unmarshall(item))
  );
}

// Batch write (up to 25 items)
async batchCreateUsers(users: CreateUserInput[]): Promise<void> {
  const chunks = this.chunkArray(users, 25);

  for (const chunk of chunks) {
    const writeRequests = chunk.map(user => ({
      PutRequest: {
        Item: marshall(this.createDynamoItem(user))
      }
    }));

    await this.dynamoClient.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: writeRequests
        }
      })
    );
  }
}
```

### Transaction Operations

```typescript
// Atomic transactions (up to 25 items)
async transferSubscription(fromUserId: string, toUserId: string): Promise<void> {
  const transactItems = [
    {
      Update: {
        TableName: this.tableName,
        Key: marshall({ PK: `USER#${fromUserId}`, SK: `USER#${fromUserId}` }),
        UpdateExpression: 'SET #status = :expired',
        ExpressionAttributeNames: { '#status': 'subscriptionStatus' },
        ExpressionAttributeValues: marshall({ ':expired': 'expired' }),
        ConditionExpression: '#status = :active'
      }
    },
    {
      Update: {
        TableName: this.tableName,
        Key: marshall({ PK: `USER#${toUserId}`, SK: `USER#${toUserId}` }),
        UpdateExpression: 'SET #status = :active',
        ExpressionAttributeNames: { '#status': 'subscriptionStatus' },
        ExpressionAttributeValues: marshall({ ':active': 'active' }),
        ConditionExpression: '#status = :pending'
      }
    }
  ];

  await this.dynamoClient.send(
    new TransactWriteItemsCommand({
      TransactItems: transactItems
    })
  );
}
```

## 🎯 Real-World Query Examples

### Complex Query Patterns

```typescript
// 1. Get all orders for a user in date range
async getUserOrdersInDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Order[]> {
  const result = await this.dynamoClient.send(
    new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
      ExpressionAttributeValues: marshall({
        ':pk': `USER#${userId}`,
        ':start': `ORDER#${startDate}`,
        ':end': `ORDER#${endDate}`
      })
    })
  );

  return result.Items?.map(item =>
    this.mapToOrder(unmarshall(item))
  ) || [];
}

// 2. Get users by subscription status with pagination
async getUsersBySubscriptionStatus(
  status: SubscriptionStatus,
  limit: number = 20,
  lastKey?: any
): Promise<{ users: User[], lastKey?: any }> {
  const result = await this.dynamoClient.send(
    new QueryCommand({
      TableName: this.tableName,
      IndexName: 'GSI3', // Subscription status index
      KeyConditionExpression: 'GSI3PK = :status',
      ExpressionAttributeValues: marshall({
        ':status': `STATUS#${status}`
      }),
      Limit: limit,
      ExclusiveStartKey: lastKey
    })
  );

  return {
    users: result.Items?.map(item =>
      this.mapDynamoItemToUser(unmarshall(item))
    ) || [],
    lastKey: result.LastEvaluatedKey
  };
}

// 3. Search users with multiple filters
async searchUsers(filters: {
  subscriptionStatus?: SubscriptionStatus;
  minFollowers?: number;
  isVerified?: boolean;
  createdAfter?: string;
}): Promise<User[]> {
  const filterExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (filters.subscriptionStatus) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'subscriptionStatus';
    expressionAttributeValues[':status'] = filters.subscriptionStatus;
  }

  if (filters.minFollowers) {
    filterExpressions.push('#followers >= :minFollowers');
    expressionAttributeNames['#followers'] = 'followerCount';
    expressionAttributeValues[':minFollowers'] = filters.minFollowers;
  }

  if (filters.isVerified !== undefined) {
    filterExpressions.push('#verified = :verified');
    expressionAttributeNames['#verified'] = 'isVerified';
    expressionAttributeValues[':verified'] = filters.isVerified;
  }

  if (filters.createdAfter) {
    filterExpressions.push('#created > :createdAfter');
    expressionAttributeNames['#created'] = 'createdAt';
    expressionAttributeValues[':createdAfter'] = filters.createdAfter;
  }

  const result = await this.dynamoClient.send(
    new ScanCommand({
      TableName: this.tableName,
      FilterExpression: filterExpressions.length > 0
        ? filterExpressions.join(' AND ')
        : undefined,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
        ? expressionAttributeNames
        : undefined,
      ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0
        ? marshall(expressionAttributeValues)
        : undefined,
    })
  );

  return result.Items?.map(item =>
    this.mapDynamoItemToUser(unmarshall(item))
  ) || [];
}
```

This implementation provides a robust, scalable foundation for user management while leveraging DynamoDB's strengths and working within its constraints.
