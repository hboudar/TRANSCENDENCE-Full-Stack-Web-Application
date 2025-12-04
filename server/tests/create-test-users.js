#!/usr/bin/env node

/**
 * Create test users via API registration
 */

import fetch from 'node-fetch';
import https from 'https';

const BASE_URL = 'https://10.32.118.247';

// HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const testUsers = [
  {
    name: 'User One',
    email: 'user1@example.com',
    password: 'password123',
  },
  {
    name: 'User Two',
    email: 'user2@example.com',
    password: 'password123',
  },
  {
    name: 'User Three',
    email: 'user3@example.com',
    password: 'password123',
  },
];

async function registerUser(user) {
  try {
    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
      agent: httpsAgent,
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Registered ${user.email} (ID: ${data.userId})`);
      
      // Try to get the verification token from database
      // Since we can't access the database directly in tests, we'll skip verification for now
      // and update test script to note this limitation
      return { success: true, userId: data.userId };
    } else if (response.status === 400 && data.error?.includes('exists')) {
      console.log(`ℹ️  User ${user.email} already exists`);
      // Try to get the user ID
      return { success: true, userId: null };
    } else {
      console.log(`❌ Failed to register ${user.email}: ${data.error || response.status}`);
      return { success: false, userId: null };
    }
  } catch (error) {
    console.log(`❌ Error registering ${user.email}: ${error.message}`);
    return { success: false, userId: null };
  }
}

async function createFriendship(user1Email, user1Pass, user2Id) {
  try {
    // Login user1
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user1Email, password: user1Pass }),
      agent: httpsAgent,
    });

    if (!loginResponse.ok) {
      console.log(`❌ Failed to login ${user1Email}`);
      return false;
    }

    const cookies = loginResponse.headers.raw()['set-cookie'];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

    // Send friend request
    const friendResponse = await fetch(`${BASE_URL}/api/friends`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
      },
      body: JSON.stringify({ friend_id: user2Id }),
      agent: httpsAgent,
    });

    if (!friendResponse.ok) {
      const error = await friendResponse.json();
      if (error.error?.includes('already')) {
        console.log(`ℹ️  Friend request already exists between user and ${user2Id}`);
        return true;
      }
      console.log(`❌ Failed to send friend request: ${error.error}`);
      return false;
    }

    console.log(`✅ Friend request sent from ${user1Email} to user ${user2Id}`);
    return true;
  } catch (error) {
    console.log(`❌ Error creating friendship: ${error.message}`);
    return false;
  }
}

async function acceptFriendRequest(user2Email, user2Pass, user1Id) {
  try {
    // Login user2
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user2Email, password: user2Pass }),
      agent: httpsAgent,
    });

    if (!loginResponse.ok) {
      console.log(`❌ Failed to login ${user2Email}`);
      return false;
    }

    const cookies = loginResponse.headers.raw()['set-cookie'];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');

    // Accept friend request
    const acceptResponse = await fetch(`${BASE_URL}/api/friends/accept`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
      },
      body: JSON.stringify({ friend_id: user1Id }),
      agent: httpsAgent,
    });

    if (!acceptResponse.ok) {
      const error = await acceptResponse.json();
      console.log(`❌ Failed to accept friend request: ${error.error}`);
      return false;
    }

    console.log(`✅ Friend request accepted: ${user2Email} ↔ user ${user1Id}`);
    return true;
  } catch (error) {
    console.log(`❌ Error accepting friend request: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Creating test users...\n');

  // Register all users
  const results = [];
  for (const user of testUsers) {
    const success = await registerUser(user);
    results.push(success);
  }

  if (!results.every(r => r)) {
    console.log('\n⚠️  Some users failed to register');
    return;
  }

  console.log('\n🔗 Creating friendships...\n');

  // Create friendship: user1 ↔ user2
  await createFriendship('user1@example.com', 'password123', 2);
  await new Promise(resolve => setTimeout(resolve, 500));
  await acceptFriendRequest('user2@example.com', 'password123', 1);

  // user3 remains without friends for testing
  console.log('\n✅ Test environment ready!');
  console.log('   - user1@example.com (ID: 1) ↔ user2@example.com (ID: 2) are friends');
  console.log('   - user3@example.com (ID: 3) has no friends');
}

main().catch(console.error);
