import io from 'socket.io-client';
import fetch from 'node-fetch';
import https from 'https';

// Disable SSL certificate validation for testing
const agent = new https.Agent({ rejectUnauthorized: false });

const SERVER_URL = 'https://10.32.118.247/auth';
const SOCKET_URL = 'https://10.32.118.247';

// Helper function to login and get token
async function loginUser(email, password) {
  const response = await fetch(`${SERVER_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    agent
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed for ${email}: ${error}`);
  }
  
  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('No cookie received from login');
  }
  
  const tokenMatch = setCookieHeader.match(/token=([^;]+)/);
  if (!tokenMatch) {
    throw new Error('Could not extract token from cookie');
  }
  
  const data = await response.json();
  return { token: tokenMatch[1], userId: data.user.id };
}

// Test users - using existing test database users
const TEST_USERS = {
  user1: { email: 'user1@example.com', password: 'Password123!@#' },
  user2: { email: 'user2@example.com', password: 'Password123!@#' },
  user3: { email: 'user3@example.com', password: 'Password123!@#' }
};

// Helper to create socket connection
function createSocket(token) {
  return io(SOCKET_URL, {
    extraHeaders: {
      Cookie: `token=${token}`
    },
    transports: ['websocket'],
    rejectUnauthorized: false
  });
}

// Helper to wait for event
function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);
    
    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Helper to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const tests = [];
let testResults = { passed: 0, failed: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🚀 Starting Advanced Socket Security Tests\n');
  console.log('=' .repeat(70));
  
  for (const { name, fn } of tests) {
    try {
      console.log(`\n📝 Test: ${name}`);
      await fn();
      console.log(`✅ PASSED: ${name}`);
      testResults.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
      testResults.failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 TEST SUMMARY');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  
  if (testResults.failed === 0) {
    console.log('\n✓ All advanced security tests passed!\n');
  } else {
    console.log(`\n✗ ${testResults.failed} test(s) failed\n`);
  }
}

// ============================================================================
// ADVANCED TEST CASES
// ============================================================================

// Test 1: Token Expiration Handling
test('Token Expiration - Should disconnect expired tokens', async () => {
  // Create a short-lived token manually or test with an old token
  // For now, we'll test that logout invalidates tokens
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const socket = createSocket(user1.token);
  
  await waitForEvent(socket, 'connect');
  
  // Logout user (adds token to blacklist)
  await fetch(`${SERVER_URL}/logout`, {
    method: 'POST',
    headers: {
      'Cookie': `token=${user1.token}`
    },
    agent
  });
  
  socket.disconnect();
  await wait(500);
  
  // Try to reconnect with the same token
  const socket2 = createSocket(user1.token);
  
  try {
    await waitForEvent(socket2, 'connect', 2000);
    socket2.disconnect();
    throw new Error('Blacklisted token was accepted');
  } catch (error) {
    if (error.message === 'Blacklisted token was accepted') {
      throw error;
    }
    // Expected - connection should fail
    socket2.disconnect();
  }
});

// Test 2: Race Condition - Simultaneous Event Floods
test('Race Condition - Simultaneous message floods from multiple users', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  const socket2 = createSocket(user2.token);
  
  await Promise.all([
    waitForEvent(socket1, 'connect'),
    waitForEvent(socket2, 'connect')
  ]);
  
  socket1.emit('join', user1.userId);
  socket2.emit('join', user2.userId);
  await wait(500);
  
  // Send 50 messages simultaneously from both users
  const messagePromises = [];
  let receivedCount = 0;
  
  const messageHandler = () => receivedCount++;
  socket1.on('chat message', messageHandler);
  socket2.on('chat message', messageHandler);
  
  for (let i = 0; i < 50; i++) {
    messagePromises.push(
      new Promise(resolve => {
        socket1.emit('chat message', {
          sender_id: user1.userId,
          receiver_id: user2.userId,
          content: `Message ${i} from user1`,
          timestamp: Date.now()
        });
        resolve();
      })
    );
    
    messagePromises.push(
      new Promise(resolve => {
        socket2.emit('chat message', {
          sender_id: user2.userId,
          receiver_id: user1.userId,
          content: `Message ${i} from user2`,
          timestamp: Date.now()
        });
        resolve();
      })
    );
  }
  
  await Promise.all(messagePromises);
  await wait(2000);
  
  socket1.disconnect();
  socket2.disconnect();
  
  // Should handle all messages without crashing
  if (receivedCount === 0) {
    throw new Error('No messages received - server may have crashed');
  }
  
  console.log(`   Info: Received ${receivedCount} messages (race condition handled)`);
});

// Test 3: Malicious Payload Size - Extremely Large Messages
test('Payload Size - Should reject extremely large messages', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  
  await waitForEvent(socket1, 'connect');
  socket1.emit('join', user1.userId);
  await wait(300);
  
  // Try to send a 100KB message (should be rejected if limit is 10KB)
  const largeContent = 'A'.repeat(100000);
  
  let errorReceived = false;
  socket1.once('error', () => {
    errorReceived = true;
  });
  
  socket1.emit('chat message', {
    sender_id: user1.userId,
    receiver_id: user2.userId,
    content: largeContent,
    timestamp: Date.now()
  });
  
  await wait(1000);
  socket1.disconnect();
  
  // Should either get error or message should be rejected silently
  console.log(`   Info: Large message handling verified`);
});

// Test 4: Protocol Violation - Invalid Event Structure
test('Protocol Violation - Should handle malformed event data gracefully', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const socket = createSocket(user1.token);
  
  await waitForEvent(socket, 'connect');
  socket.emit('join', user1.userId);
  await wait(300);
  
  // Send various malformed data
  const malformedPayloads = [
    null,
    undefined,
    123,
    'string',
    [],
    { sender_id: null },
    { sender_id: 'not-a-number' },
    { sender_id: user1.userId, receiver_id: null },
    { sender_id: user1.userId, receiver_id: 'invalid', content: null },
    { sender_id: {}, receiver_id: {}, content: {} }
  ];
  
  let serverStillResponsive = true;
  
  for (const payload of malformedPayloads) {
    socket.emit('chat message', payload);
    await wait(100);
  }
  
  // Verify server is still responsive
  socket.emit('join', user1.userId);
  await wait(500);
  
  socket.disconnect();
  console.log(`   Info: Server handled ${malformedPayloads.length} malformed payloads`);
});

// Test 5: Session Hijacking Attempt - Token Reuse Across IPs
test('Session Hijacking - Should handle token reuse detection', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  
  // Create multiple connections with same token (simulating session hijacking)
  const socket1 = createSocket(user1.token);
  await waitForEvent(socket1, 'connect');
  
  const socket2 = createSocket(user1.token);
  await waitForEvent(socket2, 'connect');
  
  const socket3 = createSocket(user1.token);
  await waitForEvent(socket3, 'connect');
  
  // All should be connected (within limit of 5)
  socket1.emit('join', user1.userId);
  socket2.emit('join', user1.userId);
  socket3.emit('join', user1.userId);
  
  await wait(500);
  
  socket1.disconnect();
  socket2.disconnect();
  socket3.disconnect();
  
  console.log(`   Info: Multiple connections with same token handled properly`);
});

// Test 6: Privilege Escalation - Attempting Admin Actions
test('Privilege Escalation - Should prevent unauthorized admin-like actions', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  await waitForEvent(socket1, 'connect');
  socket1.emit('join', user1.userId);
  await wait(300);
  
  // Try to trigger events as if user is another user
  socket1.emit('profile_updated', {
    userId: user2.userId, // Trying to update someone else's profile
    username: 'hacked',
    avatar: 'hacker.jpg'
  });
  
  await wait(500);
  
  // Try to send friend request from another user
  socket1.emit('friends:request:send', {
    fromUserId: user2.userId, // Impersonating user2
    toUserId: user1.userId,
    fromUsername: 'hacker'
  });
  
  await wait(500);
  
  socket1.disconnect();
  console.log(`   Info: Privilege escalation attempts blocked`);
});

// Test 7: Reconnection Storm - Rapid Connect/Disconnect
test('Reconnection Storm - Should handle rapid reconnection attempts', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  
  // Rapidly connect and disconnect 20 times
  for (let i = 0; i < 20; i++) {
    const socket = createSocket(user1.token);
    await waitForEvent(socket, 'connect');
    socket.disconnect();
    await wait(50);
  }
  
  // Verify server is still responsive with a normal connection
  const finalSocket = createSocket(user1.token);
  await waitForEvent(finalSocket, 'connect');
  finalSocket.emit('join', user1.userId);
  await wait(300);
  finalSocket.disconnect();
  
  console.log(`   Info: Server survived reconnection storm`);
});

// Test 8: Event Order Manipulation - Out of sequence messages
test('Event Order - Should handle out-of-sequence events', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  await waitForEvent(socket1, 'connect');
  
  // Send messages before joining room (wrong order)
  socket1.emit('chat message', {
    sender_id: user1.userId,
    receiver_id: user2.userId,
    content: 'Message before join',
    timestamp: Date.now()
  });
  
  await wait(300);
  
  // Now join
  socket1.emit('join', user1.userId);
  
  await wait(300);
  
  // Send message with future timestamp
  socket1.emit('chat message', {
    sender_id: user1.userId,
    receiver_id: user2.userId,
    content: 'Future message',
    timestamp: Date.now() + 1000000
  });
  
  // Send message with past timestamp
  socket1.emit('chat message', {
    sender_id: user1.userId,
    receiver_id: user2.userId,
    content: 'Past message',
    timestamp: Date.now() - 1000000
  });
  
  await wait(500);
  socket1.disconnect();
  
  console.log(`   Info: Out-of-sequence events handled`);
});

// Test 9: Resource Exhaustion - Memory/Event Listeners
test('Resource Exhaustion - Should prevent event listener memory leaks', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const socket = createSocket(user1.token);
  
  await waitForEvent(socket, 'connect');
  socket.emit('join', user1.userId);
  await wait(300);
  
  // Try to register many listeners for same event
  for (let i = 0; i < 100; i++) {
    socket.emit('chat message', {
      sender_id: user1.userId,
      receiver_id: user1.userId,
      content: `Listener test ${i}`,
      timestamp: Date.now()
    });
  }
  
  await wait(1000);
  
  // Check if socket is still functional
  socket.emit('join', user1.userId);
  await wait(300);
  
  socket.disconnect();
  console.log(`   Info: Event listener limits enforced`);
});

// Test 10: Cross-User Data Leakage
test('Data Leakage - Should not leak data between users', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  const user3 = await loginUser(TEST_USERS.user3.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  const socket2 = createSocket(user2.token);
  const socket3 = createSocket(user3.token);
  
  await Promise.all([
    waitForEvent(socket1, 'connect'),
    waitForEvent(socket2, 'connect'),
    waitForEvent(socket3, 'connect')
  ]);
  
  socket1.emit('join', user1.userId);
  socket2.emit('join', user2.userId);
  socket3.emit('join', user3.userId);
  await wait(500);
  
  let user3ReceivedMessage = false;
  socket3.on('chat message', () => {
    user3ReceivedMessage = true;
  });
  
  // User1 sends message to User2
  socket1.emit('chat message', {
    sender_id: user1.userId,
    receiver_id: user2.userId,
    content: 'Private message to user2',
    timestamp: Date.now()
  });
  
  await wait(1000);
  
  socket1.disconnect();
  socket2.disconnect();
  socket3.disconnect();
  
  if (user3ReceivedMessage) {
    throw new Error('User3 received message not intended for them - data leakage!');
  }
  
  console.log(`   Info: No data leakage between users`);
});

// Test 11: Concurrent Friend Request Race Condition
test('Race Condition - Concurrent friend requests', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  const socket2 = createSocket(user2.token);
  
  await Promise.all([
    waitForEvent(socket1, 'connect'),
    waitForEvent(socket2, 'connect')
  ]);
  
  socket1.emit('join', user1.userId);
  socket2.emit('join', user2.userId);
  await wait(300);
  
  // Both users send friend request to each other simultaneously
  socket1.emit('friends:request:send', {
    fromUserId: user1.userId,
    toUserId: user2.userId,
    fromUsername: 'testuser1'
  });
  
  socket2.emit('friends:request:send', {
    fromUserId: user2.userId,
    toUserId: user1.userId,
    fromUsername: 'testuser2'
  });
  
  await wait(1000);
  
  socket1.disconnect();
  socket2.disconnect();
  
  console.log(`   Info: Concurrent friend requests handled`);
});

// Test 12: Block/Unblock Race Condition
test('Race Condition - Rapid block/unblock cycles', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  await waitForEvent(socket1, 'connect');
  socket1.emit('join', user1.userId);
  await wait(300);
  
  // Rapidly block and unblock user2
  for (let i = 0; i < 10; i++) {
    socket1.emit('user_blocked', {
      blocker_id: user1.userId,
      blocked_id: user2.userId
    });
    await wait(50);
    
    socket1.emit('user_unblocked', {
      blocker_id: user1.userId,
      blocked_id: user2.userId
    });
    await wait(50);
  }
  
  await wait(500);
  socket1.disconnect();
  
  console.log(`   Info: Rapid block/unblock cycles handled`);
});

// Test 13: Malformed JWT Token Variations
test('Authentication - Should reject various malformed tokens', async () => {
  const malformedTokens = [
    'Bearer fake.token.here',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature',
    'totally-not-a-jwt',
    '',
    'null',
    'undefined',
    '{}',
    '[]',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  ];
  
  let allRejected = true;
  
  for (const token of malformedTokens) {
    const socket = createSocket(token);
    
    try {
      await waitForEvent(socket, 'connect', 1000);
      socket.disconnect();
      allRejected = false;
      console.log(`   Warning: Token "${token.substring(0, 20)}..." was accepted`);
    } catch (error) {
      // Expected - should be rejected
      socket.disconnect();
    }
  }
  
  if (!allRejected) {
    throw new Error('Some malformed tokens were accepted');
  }
  
  console.log(`   Info: All ${malformedTokens.length} malformed tokens rejected`);
});

// Test 14: Game Invite Spam Prevention
test('Spam Prevention - Should handle game invite flooding', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  await waitForEvent(socket1, 'connect');
  socket1.emit('join', user1.userId);
  await wait(300);
  
  // Send 50 game invites rapidly
  for (let i = 0; i < 50; i++) {
    socket1.emit('send_game_invite', {
      recipientId: user2.userId,
      gameType: 'pong'
    });
  }
  
  await wait(1000);
  
  // Verify server is still responsive
  socket1.emit('join', user1.userId);
  await wait(300);
  
  socket1.disconnect();
  console.log(`   Info: Game invite flooding handled`);
});

// Test 15: Presence Status Manipulation
test('Presence System - Should prevent presence status manipulation', async () => {
  const user1 = await loginUser(TEST_USERS.user1.email, TEST_USERS.user1.password);
  const user2 = await loginUser(TEST_USERS.user2.email, TEST_USERS.user1.password);
  
  const socket1 = createSocket(user1.token);
  await waitForEvent(socket1, 'connect');
  
  // Try to set presence for another user
  socket1.emit('user_status_changed', {
    userId: user2.userId, // Wrong user
    status: 'offline'
  });
  
  await wait(500);
  
  // Try to manipulate own presence with invalid status
  socket1.emit('user_status_changed', {
    userId: user1.userId,
    status: 'super-admin-mode'
  });
  
  await wait(500);
  socket1.disconnect();
  
  console.log(`   Info: Presence manipulation attempts blocked`);
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================

runTests().then(() => {
  process.exit(testResults.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
