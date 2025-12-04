#!/usr/bin/env node

/**
 * Simple test user creation script - accesses server database directly
 * Run this from the host machine (not in Docker)
 */

import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the server's sqlite.db file
const dbPath = join(__dirname, '../sqlite.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

const testUsers = [
  { id: 1, name: 'User One', email: 'user1@example.com', password: 'password123' },
  { id: 2, name: 'User Two', email: 'user2@example.com', password: 'password123' },
  { id: 3, name: 'User Three', email: 'user3@example.com', password: 'password123' },
];

async function createUser(user) {
  return new Promise((resolve, reject) => {
    // Check if user exists
    db.get('SELECT id FROM users WHERE email = ?', [user.email], async (err, row) => {
      if (err) {
        console.error(`Error checking user ${user.email}:`, err);
        reject(err);
        return;
      }

      if (row) {
        console.log(`ℹ️  User ${user.email} already exists (ID: ${row.id})`);
        // Update to verified
        db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [row.id], (err) => {
          if (err) {
            console.error(`Error verifying user:`, err);
            reject(err);
          } else {
            console.log(`   ✓ Verified user ${user.email}`);
            resolve(row.id);
          }
        });
      } else {
        // Hash password
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        // Insert user
        db.run(
          `INSERT INTO users (name, email, password, email_verified, gold, games, win, lose) 
           VALUES (?, ?, ?, 1, 100, 0, 0, 0)`,
          [user.name, user.email, hashedPassword],
          function (err) {
            if (err) {
              console.error(`Error creating user ${user.email}:`, err);
              reject(err);
            } else {
              console.log(`✅ Created ${user.email} (ID: ${this.lastID})`);
              resolve(this.lastID);
            }
          }
        );
      }
    });
  });
}

async function createFriendship(userId1, userId2) {
  return new Promise((resolve, reject) => {
    // Check if friendship exists
    db.get(
      `SELECT * FROM friends WHERE 
       (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId1, userId2, userId2, userId1],
      (err, row) => {
        if (err) {
          console.error('Error checking friendship:', err);
          reject(err);
          return;
        }

        if (row) {
          // Update to accepted if it's a request
          if (row.is_request === 1) {
            db.run(
              'UPDATE friends SET is_request = 0 WHERE id = ?',
              [row.id],
              (err) => {
                if (err) {
                  console.error('Error accepting friendship:', err);
                  reject(err);
                } else {
                  console.log(`✅ Friendship accepted: User ${userId1} ↔ User ${userId2}`);
                  resolve();
                }
              }
            );
          } else {
            console.log(`ℹ️  Friendship already exists: User ${userId1} ↔ User ${userId2}`);
            resolve();
          }
        } else {
          // Create new friendship (already accepted)
          db.run(
            `INSERT INTO friends (user_id, friend_id, is_request) VALUES (?, ?, 0)`,
            [userId1, userId2],
            function (err) {
              if (err) {
                console.error('Error creating friendship:', err);
                reject(err);
              } else {
                console.log(`✅ Friendship created: User ${userId1} ↔ User ${userId2}`);
                resolve();
              }
            }
          );
        }
      }
    );
  });
}

async function main() {
  console.log('🔧 Setting up test users...\n');

  try {
    // Create all users
    const userIds = [];
    for (const user of testUsers) {
      const userId = await createUser(user);
      userIds.push(userId);
    }

    console.log('\n🔗 Creating friendships...\n');

    // Create friendship: user1 ↔ user2
    await createFriendship(userIds[0], userIds[1]);

    console.log('\n✅ Test environment ready!');
    console.log(`   - user1@example.com (ID: ${userIds[0]}) ↔ user2@example.com (ID: ${userIds[1]}) are friends`);
    console.log(`   - user3@example.com (ID: ${userIds[2]}) has no friends`);
    console.log('\n   All users have password: password123\n');

    db.close();
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    db.close();
    process.exit(1);
  }
}

main();
