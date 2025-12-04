// Create friendship between user1 and user2
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./sqlite.db');

// Create accepted friendship (is_request = 0)
db.run(
  `INSERT OR REPLACE INTO friends (user_id, friend_id, is_request) VALUES (6, 7, 0)`,
  (err) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }
    console.log('✅ Created friendship: User 6 (user1@example.com) ↔ User 7 (user2@example.com)');
    db.close();
  }
);
