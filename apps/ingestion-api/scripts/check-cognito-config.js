#!/usr/bin/env node

/**
 * Script to check Cognito User Pool configuration
 * This helps debug SECRET_HASH issues by showing how the user pool is configured
 */

const { CognitoIdentityProviderClient, DescribeUserPoolCommand, DescribeUserPoolClientCommand } = require('@aws-sdk/client-cognito-identity-provider');
require('dotenv').config({ path: '.env.production' });

async function checkCognitoConfig() {
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    console.error('Missing COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID in environment');
    process.exit(1);
  }

  try {
    console.log('=== Cognito Configuration Check ===\n');

    // Check User Pool configuration
    console.log('1. User Pool Configuration:');
    const userPoolCommand = new DescribeUserPoolCommand({
      UserPoolId: userPoolId
    });
    
    const userPoolResponse = await client.send(userPoolCommand);
    const userPool = userPoolResponse.UserPool;

    console.log(`   Pool ID: ${userPool.Id}`);
    console.log(`   Pool Name: ${userPool.Name}`);
    console.log(`   Username Attributes: ${userPool.UsernameAttributes || 'None (uses username)'}`);
    console.log(`   Alias Attributes: ${userPool.AliasAttributes || 'None'}`);
    console.log(`   Auto Verified Attributes: ${userPool.AutoVerifiedAttributes || 'None'}`);
    console.log(`   Username Configuration: ${JSON.stringify(userPool.UsernameConfiguration || {}, null, 2)}`);

    // Check App Client configuration
    console.log('\n2. App Client Configuration:');
    const clientCommand = new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId
    });

    const clientResponse = await client.send(clientCommand);
    const appClient = clientResponse.UserPoolClient;

    console.log(`   Client ID: ${appClient.ClientId}`);
    console.log(`   Client Name: ${appClient.ClientName}`);
    console.log(`   Has Client Secret: ${!!appClient.ClientSecret}`);
    console.log(`   Explicit Auth Flows: ${appClient.ExplicitAuthFlows || 'None'}`);
    console.log(`   Supported Identity Providers: ${appClient.SupportedIdentityProviders || 'None'}`);

    // Determine username format for SECRET_HASH
    console.log('\n3. SECRET_HASH Username Format Analysis:');
    
    if (userPool.UsernameAttributes && userPool.UsernameAttributes.length > 0) {
      console.log('   ✓ User Pool uses USERNAME ATTRIBUTES configuration');
      console.log(`   ✓ Sign-in attributes: ${userPool.UsernameAttributes.join(', ')}`);
      console.log('   ✓ For SECRET_HASH: Use the actual sign-in value (email/phone) as username');
      console.log('   ✓ Example: If user signs in with "user@example.com", use "user@example.com" for SECRET_HASH');
    } else if (userPool.AliasAttributes && userPool.AliasAttributes.length > 0) {
      console.log('   ✓ User Pool uses ALIAS ATTRIBUTES configuration');
      console.log(`   ✓ Alias attributes: ${userPool.AliasAttributes.join(', ')}`);
      console.log('   ✓ For SECRET_HASH: Use the actual username (not alias) for SECRET_HASH');
      console.log('   ✓ Example: If user has username "user123" but signs in with "user@example.com", use "user123" for SECRET_HASH');
    } else {
      console.log('   ✓ User Pool uses standard USERNAME configuration');
      console.log('   ✓ For SECRET_HASH: Use the username as provided during signup');
    }

    // Check for common issues
    console.log('\n4. Common SECRET_HASH Issues:');
    console.log('   - Ensure client secret matches exactly what\'s in AWS Console');
    console.log('   - Username format must match user pool configuration');
    console.log('   - For refresh tokens, username might need to be the "sub" claim');
    console.log('   - Case sensitivity matters for usernames');

  } catch (error) {
    console.error('Error checking Cognito configuration:', error.message);
    
    if (error.name === 'AccessDeniedException') {
      console.error('\nPermission issue: Make sure your AWS credentials have cognito-idp:DescribeUserPool* permissions');
    }
  }
}

if (require.main === module) {
  checkCognitoConfig();
}

module.exports = { checkCognitoConfig };
