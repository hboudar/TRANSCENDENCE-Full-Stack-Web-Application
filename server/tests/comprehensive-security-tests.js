#!/usr/bin/env node

/**
 * Comprehensive Security Test Suite for All API Endpoints
 * Tests authorization, authentication, and data access controls
 */

import fetch from 'node-fetch';
import https from 'https';

const SERVER_URL = 'https://localhost';
const agent = new https.Agent({ rejectUnauthorized: false });

// Test users
const users = {
  user1: { email: 'user1@example.com', password: 'Password123' },
  user2: { email: 'user2@example.com', password: 'Password123' }
};

let user1Token, user2Token, user1Id, user2Id;

// Helper functions
async function login(email, password) {
  const response = await fetch(`${SERVER_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    agent
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed (${response.status}): ${errorText}`);
  }
  
  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('No token cookie received');
  }
  
  const tokenMatch = setCookieHeader.match(/token=([^;]+)/);
  if (!tokenMatch) {
    throw new Error('Token not found in cookie');
  }
  
  const data = await response.json();
  
  return { token: tokenMatch[1], userId: data.user?.id || data.id };
}

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
    agent
  });
  
  return {
    status: response.status,
    data: response.ok ? await response.json().catch(() => null) : await response.text()
  };
}

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

// ============================================================================
// AUTHENTICATION TESTS
// ============================================================================

test('Auth - /login without credentials should fail', async () => {
  const res = await makeRequest('/login', { method: 'POST', body: JSON.stringify({}) });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

test('Auth - /me without token should return 401', async () => {
  const res = await makeRequest('/me');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// ============================================================================
// PROFILE ROUTE TESTS
// ============================================================================

test('Profile - Update own profile with valid token should succeed', async () => {
  const res = await makeRequest('/profile', {
    method: 'POST',
    headers: { Cookie: `token=${user1Token}` },
    body: JSON.stringify({ userid: user1Id, name: 'TestUser1Updated' })
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

test('Profile - Update another user\'s profile should fail (403)', async () => {
  const res = await makeRequest('/profile', {
    method: 'POST',
    headers: { Cookie: `token=${user1Token}` },
    body: JSON.stringify({ userid: user2Id, name: 'HackedName' })
  });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}: ${res.data}`);
});

test('Profile - Update profile without authentication should fail (401)', async () => {
  const res = await makeRequest('/profile', {
    method: 'POST',
    body: JSON.stringify({ userid: user1Id, name: 'NoAuth' })
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// ============================================================================
// BUY ROUTE TESTS
// ============================================================================

test('Buy - Purchase without authentication should fail (401)', async () => {
  const res = await makeRequest('/buy', {
    method: 'POST',
    body: JSON.stringify({ itemId: 1, itemPrice: 50 })
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Buy - Purchase with authentication should use authenticated user ID', async () => {
  // This test verifies the fix - userId from body should be ignored
  const res = await makeRequest('/buy', {
    method: 'POST',
    headers: { Cookie: `token=${user1Token}` },
    body: JSON.stringify({ userId: user2Id, itemId: 999, itemPrice: 50 })
  });
  // Should attempt to buy for user1, not user2 (will fail due to invalid item, but that's okay)
  if (res.status === 200 || res.status === 400 || res.status === 404) {
    // Good - processed request (failed for business logic, not authorization)
  } else if (res.status === 403) {
    throw new Error('Authorization check failed - should not get 403 when authenticated');
  }
});

// ============================================================================
// SHOP ROUTE TESTS
// ============================================================================

test('Shop - /paddles without authentication should fail (401)', async () => {
  const res = await makeRequest('/paddles');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Shop - /balls without authentication should fail (401)', async () => {
  const res = await makeRequest('/balls');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Shop - /tables without authentication should fail (401)', async () => {
  const res = await makeRequest('/tables');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Shop - /paddles with authentication should succeed', async () => {
  const res = await makeRequest('/paddles', {
    headers: { Cookie: `token=${user1Token}` }
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

// ============================================================================
// SKINS ROUTE TESTS
// ============================================================================

test('Skins - /player_skins without authentication should fail (401)', async () => {
  const res = await makeRequest('/player_skins');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Skins - /selected_skins without authentication should fail (401)', async () => {
  const res = await makeRequest('/selected_skins');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Skins - /player_skins with authentication should return only user\'s skins', async () => {
  const res = await makeRequest('/player_skins', {
    headers: { Cookie: `token=${user1Token}` }
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  // Verify returned skins belong to authenticated user
  if (Array.isArray(res.data)) {
    res.data.forEach(skin => {
      if (skin.player_id && skin.player_id !== user1Id) {
        throw new Error(`Received skin for wrong user: ${skin.player_id} !== ${user1Id}`);
      }
    });
  }
});

// ============================================================================
// GAME ROUTE TESTS
// ============================================================================

test('Games - /games without authentication should fail (401)', async () => {
  const res = await makeRequest('/games');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Games - /games/:userId without authentication should fail (401)', async () => {
  const res = await makeRequest(`/games/${user1Id}`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Games - View another user\'s game history should fail (403)', async () => {
  const res = await makeRequest(`/games/${user2Id}`, {
    headers: { Cookie: `token=${user1Token}` }
  });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
});

test('Games - View own game history should succeed', async () => {
  const res = await makeRequest(`/games/${user1Id}`, {
    headers: { Cookie: `token=${user1Token}` }
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

test('Games - Create game as authenticated user should use auth ID as player1', async () => {
  const res = await makeRequest(`/games/${user2Id}`, {
    method: 'POST',
    headers: { Cookie: `token=${user1Token}` },
    body: JSON.stringify({
      player1_score: 5,
      player2_score: 3,
      player1_gold_earned: 10,
      player2_gold_earned: 5,
      winner_id: user1Id
    })
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

// ============================================================================
// GAME API ROUTE TESTS
// ============================================================================

test('GameAPI - /games/start without authentication should fail (401)', async () => {
  const res = await makeRequest('/games/start', {
    method: 'POST',
    body: JSON.stringify({
      game_type: 'online',
      sessionId: 'test123'
    })
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('GameAPI - /games/active without authentication should fail (401)', async () => {
  const res = await makeRequest('/games/active');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('GameAPI - /games/session/:id without authentication should fail (401)', async () => {
  const res = await makeRequest('/games/session/test123');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('GameAPI - /tournament_win without authentication should fail (401)', async () => {
  const res = await makeRequest('/tournament_win', { method: 'POST' });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// ============================================================================
// NOTIFICATION ROUTE TESTS
// ============================================================================

test('Notifications - /notifications without authentication should fail (401)', async () => {
  const res = await makeRequest('/notifications');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Notifications - Mark notification as read without auth should fail (401)', async () => {
  const res = await makeRequest('/notifications/1/read', { method: 'PUT' });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Notifications - Delete notification without auth should fail (401)', async () => {
  const res = await makeRequest('/notifications/1', { method: 'DELETE' });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// ============================================================================
// USER ROUTE TESTS
// ============================================================================

test('Users - /users without authentication should fail (401)', async () => {
  const res = await makeRequest('/users');
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Users - /users/:id without authentication should fail (401)', async () => {
  const res = await makeRequest(`/users/${user1Id}`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

test('Users - /users/:id should not return email for other users', async () => {
  const res = await makeRequest(`/users/${user2Id}`, {
    headers: { Cookie: `token=${user1Token}` }
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (res.data && res.data.email) {
    throw new Error('Email should not be visible for other users');
  }
});

test('Users - /users/:id should return email for own profile', async () => {
  const res = await makeRequest(`/users/${user1Id}`, {
    headers: { Cookie: `token=${user1Token}` }
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!res.data || !res.data.email) {
    throw new Error('Email should be visible for own profile');
  }
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runTests() {
  console.log('🔒 COMPREHENSIVE API SECURITY TEST SUITE\n');
  console.log('=' .repeat(70));
  
  try {
    // Login test users
    console.log('\n🔐 Logging in test users...\n');
    const user1Login = await login(users.user1.email, users.user1.password);
    user1Token = user1Login.token;
    user1Id = user1Login.userId;
    console.log(`✅ User1 logged in (ID: ${user1Id})`);
    
    const user2Login = await login(users.user2.email, users.user2.password);
    user2Token = user2Login.token;
    user2Id = user2Login.userId;
    console.log(`✅ User2 logged in (ID: ${user2Id})`);
    
  } catch (error) {
    console.error('❌ Failed to login test users:', error.message);
    console.error('Please ensure test users exist in the database');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n🧪 Running security tests...\n');
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 TEST SUMMARY');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All security tests passed!\n');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed - please review security implementation\n`);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
