/**
 * Helper script to create and verify test users in the database
 * Run this before security tests
 */

import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const db = new sqlite3.Database('../sqlite.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
    process.exit(1);
  }
});

const testUsers = [
  {
    name: 'security_test_user1',
    email: 'security_test1@test.com',
    password: 'TestPass123!',
  },
  {
    name: 'security_test_user2',
    email: 'security_test2@test.com',
    password: 'TestPass456!',
  },
];

async function prepareTestUsers() {
  console.log('🔧 Preparing test users...\n');
  
  for (const user of testUsers) {
    // Check if user exists
    const existing = await new Promise((resolve) => {
      db.get('SELECT * FROM users WHERE email = ?', [user.email], (err, row) => {
        resolve(row);
      });
    });
    
    if (existing) {
      console.log(`✅ User ${user.email} already exists (ID: ${existing.id})`);
      
      // Update to verified
      await new Promise((resolve) => {
        db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [existing.id], () => {
          console.log(`   ✓ Verified user ${user.email}`);
          resolve();
        });
      });
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (name, email, password, email_verified) VALUES (?, ?, ?, 1)',
          [user.name, user.email, hashedPassword],
          function(err) {
            if (err) {
              console.error(`❌ Failed to create user ${user.email}:`, err.message);
              reject(err);
            } else {
              console.log(`✅ Created and verified user ${user.email} (ID: ${this.lastID})`);
              resolve();
            }
          }
        );
      });
    }
  }
  
  console.log('\n✅ Test users ready!');
  console.log('\nTest credentials:');
  testUsers.forEach(user => {
    console.log(`  📧 ${user.email} / ${user.password}`);
  });
  
  db.close();
}

prepareTestUsers().catch(console.error);
