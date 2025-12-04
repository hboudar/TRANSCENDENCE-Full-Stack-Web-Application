// Quick script to update email_verified for test users
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./sqlite.db');

db.run(
  'UPDATE users SET email_verified = 1 WHERE email IN (?, ?, ?)',
  ['user1@example.com', 'user2@example.com', 'user3@example.com'],
  (err) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }
    console.log('✅ Updated email_verified for test users');
    
    db.all('SELECT id, email, email_verified FROM users WHERE email LIKE ?', ['user%@example.com'], (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\nTest users:');
        rows.forEach(row => console.log(`  - ID ${row.id}: ${row.email} (verified: ${row.email_verified})`));
      }
      db.close();
    });
  }
);
