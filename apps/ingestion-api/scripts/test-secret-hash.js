#!/usr/bin/env node

/**
 * Test script to verify SECRET_HASH calculation for AWS Cognito
 * 
 * Usage:
 *   node scripts/test-secret-hash.js <username> <client_id> <client_secret>
 * 
 * Example:
 *   node scripts/test-secret-hash.js testuser 1234567890abcdef mysecretkey
 */

const crypto = require('crypto');

function calculateSecretHash(username, clientId, clientSecret) {
  const message = username + clientId;
  const hmac = crypto.createHmac('sha256', clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Usage: node test-secret-hash.js <username> <client_id> <client_secret>');
    console.error('');
    console.error('Example:');
    console.error('  node test-secret-hash.js testuser 1234567890abcdef mysecretkey');
    process.exit(1);
  }

  const [username, clientId, clientSecret] = args;
  
  console.log('=== AWS Cognito SECRET_HASH Calculator ===');
  console.log('');
  console.log('Input Parameters:');
  console.log(`  Username: ${username}`);
  console.log(`  Client ID: ${clientId}`);
  console.log(`  Client Secret: ${'*'.repeat(clientSecret.length)} (hidden)`);
  console.log('');
  
  const secretHash = calculateSecretHash(username, clientId, clientSecret);
  
  console.log('Calculation:');
  console.log(`  Message: "${username}${clientId}"`);
  console.log(`  HMAC-SHA256: (calculated with client secret)`);
  console.log(`  Base64 Encoded: ${secretHash}`);
  console.log('');
  
  console.log('Use this SECRET_HASH value in your Cognito API calls:');
  console.log(`  SECRET_HASH: ${secretHash}`);
  console.log('');
  
  // Example API call format
  console.log('Example InitiateAuth call:');
  console.log(JSON.stringify({
    ClientId: clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: 'your-password',
      SECRET_HASH: secretHash
    }
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { calculateSecretHash };
