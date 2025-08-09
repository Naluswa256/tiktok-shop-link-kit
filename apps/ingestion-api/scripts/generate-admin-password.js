#!/usr/bin/env node

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generatePasswordHash() {
  console.log('🔐 Admin Password Hash Generator');
  console.log('================================');
  console.log('');
  
  rl.question('Enter the admin password: ', (password) => {
    if (!password || password.length < 8) {
      console.log('❌ Password must be at least 8 characters long');
      rl.close();
      process.exit(1);
    }
    
    console.log('🔄 Generating hash...');
    
    try {
      const saltRounds = 12;
      const hash = bcrypt.hashSync(password, saltRounds);
      
      console.log('');
      console.log('✅ Password hash generated successfully!');
      console.log('');
      console.log('📋 Add this to your .env file:');
      console.log(`ADMIN_PASSWORD_HASH=${hash}`);
      console.log('');
      console.log('⚠️  Security reminders:');
      console.log('   - Never share this hash publicly');
      console.log('   - Store it securely in your environment variables');
      console.log('   - Consider using AWS Secrets Manager for production');
      console.log('');
      
    } catch (error) {
      console.error('❌ Error generating hash:', error.message);
      process.exit(1);
    }
    
    rl.close();
  });
}

// Verify hash function for testing
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    generatePasswordHash();
  } else if (args[0] === 'verify' && args.length === 3) {
    const [, password, hash] = args;
    const isValid = verifyPassword(password, hash);
    console.log(`Password verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  } else {
    console.log('Usage:');
    console.log('  node generate-admin-password.js                    # Generate new hash');
    console.log('  node generate-admin-password.js verify <pwd> <hash> # Verify password');
  }
}

module.exports = { generatePasswordHash, verifyPassword };
