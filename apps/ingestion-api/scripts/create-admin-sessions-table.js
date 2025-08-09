#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

// Configuration
const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined, // For LocalStack
  tableName: process.env.ADMIN_SESSIONS_TABLE || 'AdminSessions',
};

const client = new DynamoDBClient({
  region: config.region,
  ...(config.endpoint && { endpoint: config.endpoint }),
});

async function createAdminSessionsTable() {
  const tableParams = {
    TableName: config.tableName,
    KeySchema: [
      {
        AttributeName: 'PK',
        KeyType: 'HASH', // Partition key
      },
      {
        AttributeName: 'SK',
        KeyType: 'RANGE', // Sort key
      },
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'PK',
        AttributeType: 'S',
      },
      {
        AttributeName: 'SK',
        AttributeType: 'S',
      },
      {
        AttributeName: 'GSI1PK',
        AttributeType: 'S',
      },
      {
        AttributeName: 'GSI1SK',
        AttributeType: 'S',
      },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          {
            AttributeName: 'GSI1PK',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'GSI1SK',
            KeyType: 'RANGE',
          },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    // Check if table already exists
    try {
      await client.send(new DescribeTableCommand({ TableName: config.tableName }));
      console.log(`✅ Table ${config.tableName} already exists`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create the table
    console.log(`🚀 Creating table ${config.tableName}...`);
    const result = await client.send(new CreateTableCommand(tableParams));
    
    console.log(`✅ Table ${config.tableName} created successfully!`);
    console.log(`📋 Table ARN: ${result.TableDescription.TableArn}`);
    
    // Wait for table to be active
    console.log('⏳ Waiting for table to become active...');
    let tableStatus = 'CREATING';
    while (tableStatus !== 'ACTIVE') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const describeResult = await client.send(new DescribeTableCommand({ TableName: config.tableName }));
      tableStatus = describeResult.Table.TableStatus;
      console.log(`📊 Table status: ${tableStatus}`);
    }
    
    console.log(`🎉 Table ${config.tableName} is now active and ready to use!`);
    
  } catch (error) {
    console.error(`❌ Error creating table: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  console.log('🔧 Setting up AdminSessions DynamoDB table...');
  console.log(`📍 Region: ${config.region}`);
  console.log(`🏷️  Table Name: ${config.tableName}`);
  if (config.endpoint) {
    console.log(`🔗 Endpoint: ${config.endpoint}`);
  }
  console.log('');
  
  createAdminSessionsTable()
    .then(() => {
      console.log('✨ Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createAdminSessionsTable };
