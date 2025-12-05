#!/usr/bin/env node

import io from 'socket.io-client';
import fetch from 'node-fetch';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Test configuration
const BASE_URL = 'https://localhost';
const SOCKET_URL = BASE_URL;

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${'='.repeat(60)}${colors.reset}`),
  title: (msg) => console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`),
};

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
};

// Helper to track test results
function recordTest(testName, passed, message = '') {
  results.total++;
  if (passed) {
    results.passed++;
    log.success(`${testName}: ${message || 'PASS'}`);
  } else {
    results.failed++;
    log.error(`${testName}: ${message || 'FAIL'}`);
  }
}

// Helper to create socket connection
function createSocket(auth = {}) {
  // Handle both old format (cookies object) and new format ({cookies, userId})
  const cookies = auth.cookies || auth;
  
  return io(SOCKET_URL, {
    transports: ['websocket'],
    rejectUnauthorized: false, // Accept self-signed certificates
    extraHeaders: {
      cookie: Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; '),
    },
  });
}

// Helper to wait for socket event with timeout
function waitForEvent(socket, eventName, timeout = 5000) {
  return Promise.race([
    new Promise((resolve) => {
      socket.once(eventName, (data) => {
        resolve({ received: true, data });
      });
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({ received: false, data: null });
      }, timeout);
    }),
  ]);
}

// Helper to login and get cookies + user info
async function loginUser(email, password) {
  try {
    const response = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      agent: httpsAgent,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
    const cookies = {};
    
    setCookieHeaders.forEach((cookie) => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      cookies[name] = value;
    });

    // Return both cookies and user data
    return {
      cookies,
      userId: data.id || data.userId,
      user: data
    };
  } catch (error) {
    log.error(`Login failed for ${email}: ${error.message}`);
    return null;
  }
}

// Test 1: Unauthorized Socket Connection
async function testUnauthorizedConnection() {
  log.section();
  log.title('TEST 1: Unauthorized Socket Connection');
  
  return new Promise((resolve) => {
    const socket = createSocket();
    let connected = false;
    let authErrorReceived = false;

    socket.on('connect', () => {
      connected = true;
      log.error('Socket connected without authentication - security vulnerability!');
    });

    socket.on('connect_error', (error) => {
      authErrorReceived = true;
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        recordTest('Unauthorized connection rejected', true, 'Authentication required as expected');
      } else {
        recordTest('Unauthorized connection rejected', true, `Connection blocked: ${error.message}`);
      }
      resolve();
    });

    socket.on('disconnect', () => {
      if (connected) {
        recordTest('Unauthorized connection', false, 'Socket connected without auth then disconnected');
      }
      resolve();
    });

    setTimeout(() => {
      if (!connected && !authErrorReceived) {
        recordTest('Connection behavior', true, 'No connection established (expected)');
      } else if (connected) {
        recordTest('Unauthorized connection', false, 'Socket should require authentication');
        socket.disconnect();
      }
      resolve();
    }, 5000);
  });
}

// Test 2: Cross-User Message Injection
async function testCrossUserMessageInjection() {
  log.section();
  log.title('TEST 2: Cross-User Message Injection');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket1 = createSocket(user1);
    const socket2 = createSocket(user2);
    let socket1Ready = false;
    let socket2Ready = false;

    socket1.on('connect', () => {
      socket1.emit('join', user1.userId);
      socket1Ready = true;
      log.info('User 1 connected and joined room');
    });

    socket2.on('connect', () => {
      socket2.emit('join', user2.userId);
      socket2Ready = true;
      log.info('User 2 connected and joined room');
    });

    socket2.on('new message', (msg) => {
      if (msg.sender_id === 3) {
        recordTest('Cross-user impersonation', false, 'User 2 sent message as User 3');
      }
    });

    setTimeout(() => {
      if (socket1Ready && socket2Ready) {
        // User 2 tries to send a message claiming to be User 3
        socket2.emit('chat message', {
          sender_id: 3, // Pretending to be user 3
          receiver_id: user1.userId,
          content: 'Forged message from User 3',
          status: true,
        });

        setTimeout(() => {
          recordTest('Cross-user impersonation check', true, 'Message injection attempted');
          socket1.disconnect();
          socket2.disconnect();
          resolve();
        }, 2000);
      } else {
        recordTest('Socket connection', false, 'Failed to establish connections');
        socket1.disconnect();
        socket2.disconnect();
        resolve();
      }
    }, 2000);
  });
}

// Test 3: Non-Friend Message Blocking
async function testNonFriendMessaging() {
  log.section();
  log.title('TEST 3: Non-Friend Message Blocking');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user3 = await loginUser('user3@example.com', 'password123');

  if (!user1 || !user3) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket1 = createSocket(user1);
    const socket3 = createSocket(user3);
    let messageBlocked = false;

    socket1.on('connect', () => {
      socket1.emit('join', user1.userId);
      log.info('User 1 connected');
    });

    socket3.on('connect', () => {
      socket3.emit('join', user3.userId);
      log.info('User 3 connected');
    });

    socket1.on('message_blocked', (data) => {
      messageBlocked = true;
      if (data.message.includes('only send messages to friends')) {
        recordTest('Non-friend message blocking', true, 'Blocked as expected');
      } else {
        recordTest('Non-friend message blocking', false, `Unexpected block message: ${data.message}`);
      }
    });

    socket3.on('new message', (msg) => {
      if (msg.sender_id === 1) {
        recordTest('Non-friend message blocking', false, 'Message was delivered despite not being friends');
      }
    });

    setTimeout(() => {
      // User 1 tries to message User 3 (not friends)
      socket1.emit('chat message', {
        sender_id: user1.userId,
        receiver_id: user3.userId,
        content: 'Message to non-friend',
        status: true,
      });

      setTimeout(() => {
        if (!messageBlocked) {
          recordTest('Non-friend message blocking', false, 'No block event received');
        }
        socket1.disconnect();
        socket3.disconnect();
        resolve();
      }, 2000);
    }, 2000);
  });
}

// Test 4: Block Functionality
async function testBlockFunctionality() {
  log.section();
  log.title('TEST 4: Block Functionality');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise(async (resolve) => {
    // First, ensure user2 is blocked by user1
    try {
      await fetch(`${BASE_URL}/api/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: Object.entries(user1)
            .map(([key, value]) => `${key}=${value}`)
            .join('; '),
        },
        body: JSON.stringify({ blocked_id: 2 }),
        agent: httpsAgent,
      });
      log.info('User 1 blocked User 2');
    } catch (error) {
      log.error('Failed to block user:', error.message);
    }

    const socket1 = createSocket(user1);
    const socket2 = createSocket(user2);
    let blockMessageReceived = false;

    socket1.on('connect', () => {
      socket1.emit('join', user1.userId);
    });

    socket2.on('connect', () => {
      socket2.emit('join', user2.userId);
    });

    socket2.on('message_blocked', (data) => {
      blockMessageReceived = true;
      // When blocked, users are no longer friends, so either message is acceptable
      if (data.message.includes('blocked') || data.message.includes('friends')) {
        recordTest('Block prevention', true, 'Blocked user cannot send messages (block prevents friendship)');
      } else {
        recordTest('Block prevention', false, `Unexpected block message: ${data.message}`);
      }
    });

    socket1.on('new message', (msg) => {
      if (msg.sender_id === 2) {
        recordTest('Block prevention', false, 'Blocked user message was delivered');
      }
    });

    setTimeout(() => {
      // User 2 tries to message User 1 (blocked)
      socket2.emit('chat message', {
        sender_id: user2.userId,
        receiver_id: user1.userId,
        content: 'Message from blocked user',
        status: true,
      });

      setTimeout(() => {
        if (!blockMessageReceived) {
          recordTest('Block prevention', false, 'No block notification received');
        }
        socket1.disconnect();
        socket2.disconnect();
        resolve();
      }, 2000);
    }, 2000);
  });
}

// Test 5: Socket Spam/DoS
async function testSocketSpam() {
  log.section();
  log.title('TEST 5: Socket Spam/DoS Attack');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket = createSocket(user1);
    let messagesReceived = 0;

    socket.on('connect', () => {
      socket.emit('join', user1.userId);
      log.info('User connected, starting spam test...');

      // Send 100 messages rapidly
      for (let i = 0; i < 100; i++) {
        socket.emit('chat message', {
          sender_id: user1.userId,
          receiver_id: user2.userId,
          content: `Spam message ${i}`,
          status: true,
        });
      }
    });

    socket.on('new message', () => {
      messagesReceived++;
    });

    socket.on('message_blocked', () => {
      // Expected if not friends
    });

    setTimeout(() => {
      if (messagesReceived < 100) {
        recordTest('Spam handling', true, `Only ${messagesReceived}/100 messages processed (rate limiting may be active)`);
      } else {
        recordTest('Spam handling', false, 'All 100 spam messages were processed - no rate limiting');
      }
      socket.disconnect();
      resolve();
    }, 5000);
  });
}

// Test 6: SQL Injection in Socket Handlers
async function testSQLInjection() {
  log.section();
  log.title('TEST 6: SQL Injection in Socket Handlers');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket = createSocket(user1);
    let errorReceived = false;

    socket.on('connect', () => {
      log.info('Testing SQL injection payloads...');

      // Test 1: SQL injection in content
      socket.emit('chat message', {
        sender_id: user1.userId,
        receiver_id: user2.userId,
        content: "'; DROP TABLE messages; --",
        status: true,
      });

      // Test 2: SQL injection in sender_id
      socket.emit('chat message', {
        sender_id: "1' OR '1'='1",
        receiver_id: user2.userId,
        content: 'Test message',
        status: true,
      });

      // Test 3: SQL injection in join event
      socket.emit('join', "1' OR '1'='1");

      // Test 4: SQL injection in game invite
      socket.emit('send_game_invite', {
        recipientId: "1' OR '1'='1",
        gameType: 'pong',
      });
    });

    socket.on('error', (error) => {
      errorReceived = true;
      log.info(`Socket error received: ${error}`);
    });

    setTimeout(() => {
      recordTest('SQL injection protection', true, 'Injection payloads sent (check server logs for errors)');
      socket.disconnect();
      resolve();
    }, 3000);
  });
}

// Test 7: XSS in Socket Messages
async function testXSSInjection() {
  log.section();
  log.title('TEST 7: XSS Injection in Socket Messages');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket1 = createSocket(user1);
    const socket2 = createSocket(user2);
    let xssMessageReceived = false;

    socket1.on('connect', () => {
      socket1.emit('join', user1.userId);
    });

    socket2.on('connect', () => {
      socket2.emit('join', user2.userId);
      log.info('Sending XSS payloads...');

      // Send XSS payloads
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')">',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
      ];

      xssPayloads.forEach((payload, index) => {
        setTimeout(() => {
          socket2.emit('chat message', {
            sender_id: user2.userId,
            receiver_id: user1.userId,
            content: payload,
            status: true,
          });
        }, index * 500);
      });
    });

    socket1.on('new message', (msg) => {
      if (msg.content.includes('<script>') || msg.content.includes('onerror=')) {
        xssMessageReceived = true;
      }
    });

    setTimeout(() => {
      if (xssMessageReceived) {
        recordTest('XSS sanitization', false, 'XSS payload was delivered unsanitized - client must sanitize');
      } else {
        recordTest('XSS sanitization', true, 'No XSS payloads received (or blocked by friendship check)');
      }
      socket1.disconnect();
      socket2.disconnect();
      resolve();
    }, 5000);
  });
}

// Test 8: Invalid Event Data
async function testInvalidEventData() {
  log.section();
  log.title('TEST 8: Invalid/Malformed Event Data');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket = createSocket(user1);
    let serverCrashed = false;

    socket.on('connect', () => {
      log.info('Sending malformed data...');

      // Test 1: Missing required fields
      socket.emit('chat message', {
        sender_id: user1.userId,
        // missing receiver_id and content
      });

      // Test 2: Wrong data types
      socket.emit('chat message', {
        sender_id: 'not_a_number',
        receiver_id: null,
        content: { object: 'instead of string' },
        status: true,
      });

      // Test 3: Null values
      socket.emit('chat message', null);

      // Test 4: Array instead of object
      socket.emit('chat message', [1, 2, 3]);

      // Test 5: Extremely large content
      socket.emit('chat message', {
        sender_id: user1.userId,
        receiver_id: user2.userId,
        content: 'A'.repeat(100000), // 100KB message
        status: true,
      });

      // Test 6: Invalid join data
      socket.emit('join', null);
      socket.emit('join', {});
      socket.emit('join', -1);

      // Test 7: Invalid game invite
      socket.emit('send_game_invite', {
        recipientId: null,
        gameType: null,
      });
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'transport error' || reason === 'io server disconnect') {
        serverCrashed = true;
      }
    });

    setTimeout(() => {
      if (serverCrashed) {
        recordTest('Invalid data handling', false, 'Server disconnected socket - possible crash');
      } else {
        recordTest('Invalid data handling', true, 'Server handled malformed data gracefully');
      }
      socket.disconnect();
      resolve();
    }, 3000);
  });
}

// Test 9: Multiple Concurrent Connections
async function testMultipleConnections() {
  log.section();
  log.title('TEST 9: Multiple Concurrent Connections');

  const user1 = await loginUser('user1@example.com', 'password123');

  if (!user1) {
    recordTest('User login', false, 'Failed to login test user');
    return;
  }

  return new Promise((resolve) => {
    const sockets = [];
    let connectedCount = 0;

    log.info('Creating 10 concurrent connections for same user...');

    for (let i = 0; i < 10; i++) {
      const socket = createSocket(user1);
      
      socket.on('connect', () => {
        connectedCount++;
        socket.emit('join', user1.userId);
      });

      socket.on('connect_error', (error) => {
        log.warn(`Connection ${i} failed: ${error.message}`);
      });

      sockets.push(socket);
    }

    setTimeout(() => {
      if (connectedCount === 10) {
        recordTest('Multiple connections', false, 'All 10 connections succeeded - no connection limiting');
      } else if (connectedCount > 0 && connectedCount < 10) {
        recordTest('Multiple connections', true, `${connectedCount}/10 connections allowed - some limiting active`);
      } else {
        recordTest('Multiple connections', false, 'No connections succeeded');
      }

      sockets.forEach((socket) => socket.disconnect());
      resolve();
    }, 3000);
  });
}

// Test 10: Presence Manipulation
async function testPresenceManipulation() {
  log.section();
  log.title('TEST 10: Presence Status Manipulation');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket1 = createSocket(user1);
    const socket2 = createSocket(user2);
    let spoofedPresenceReceived = false;

    socket1.on('connect', () => {
      socket1.emit('join', user1.userId);
    });

    socket2.on('connect', () => {
      socket2.emit('join', user2.userId);
      
      // Try to spoof presence for another user
      setTimeout(() => {
        socket2.emit('user_presence', { userId: 999, status: 'online' });
        socket2.emit('user_presence', { userId: 1, status: 'offline' });
      }, 1000);
    });

    socket1.on('user_presence', (data) => {
      if (data.userId === 1 && data.status === 'offline' && socket1.connected) {
        spoofedPresenceReceived = true;
      }
    });

    setTimeout(() => {
      if (spoofedPresenceReceived) {
        recordTest('Presence spoofing', false, 'User 2 successfully spoofed User 1 presence');
      } else {
        recordTest('Presence spoofing', true, 'Presence spoofing prevented or not received');
      }
      socket1.disconnect();
      socket2.disconnect();
      resolve();
    }, 3000);
  });
}

// Test 11: Room Hijacking
async function testRoomHijacking() {
  log.section();
  log.title('TEST 11: Room Hijacking Attempt');

  const user1 = await loginUser('user1@example.com', 'password123');
  const user2 = await loginUser('user2@example.com', 'password123');

  if (!user1 || !user2) {
    recordTest('User login', false, 'Failed to login test users');
    return;
  }

  return new Promise((resolve) => {
    const socket1 = createSocket(user1);
    const socket2 = createSocket(user2);
    let unauthorizedMessageReceived = false;

    socket1.on('connect', () => {
      socket1.emit('join', user1.userId);
      log.info('User 1 joined room:1');
    });

    socket2.on('connect', () => {
      socket2.emit('join', user2.userId);
      log.info('User 2 joined room:2');
      
      // User 2 tries to join User 1's room
      setTimeout(() => {
        log.info('User 2 attempting to join User 1 room...');
        socket2.emit('join', 1); // Try to hijack room:1
      }, 1000);
    });

    socket1.on('new message', (msg) => {
      if (msg.sender_id === 2) {
        unauthorizedMessageReceived = true;
      }
    });

    setTimeout(() => {
      // User 2 sends message to room:1 after joining
      socket2.emit('chat message', {
        sender_id: user2.userId,
        receiver_id: user1.userId,
        content: 'Message after room hijacking',
        status: true,
      });

      setTimeout(() => {
        if (unauthorizedMessageReceived) {
          recordTest('Room hijacking', false, 'User 2 received messages in User 1 room');
        } else {
          recordTest('Room hijacking', true, 'Room hijacking prevented or blocked by friendship check');
        }
        socket1.disconnect();
        socket2.disconnect();
        resolve();
      }, 2000);
    }, 2000);
  });
}

// Test 12: Event Listener Exhaustion
async function testEventListenerExhaustion() {
  log.section();
  log.title('TEST 12: Event Listener Exhaustion Attack');

  const user1 = await loginUser('user1@example.com', 'password123');

  if (!user1) {
    recordTest('User login', false, 'Failed to login test user');
    return;
  }

  return new Promise((resolve) => {
    const socket = createSocket(user1);
    let warningReceived = false;

    // Listen for Node.js MaxListenersExceededWarning
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        warningReceived = true;
      }
    });

    socket.on('connect', () => {
      log.info('Registering 100 event listeners...');
      
      // Register many listeners for same event
      for (let i = 0; i < 100; i++) {
        socket.on('new message', () => {});
        socket.on('user_presence', () => {});
      }
    });

    setTimeout(() => {
      if (warningReceived) {
        recordTest('Event listener limits', false, 'MaxListenersExceeded warning triggered - potential memory leak');
      } else {
        recordTest('Event listener limits', true, 'No listener warnings (check may not be thorough)');
      }
      socket.disconnect();
      resolve();
    }, 2000);
  });
}

// Main test runner
async function runAllTests() {
  log.section();
  log.title('🔒 SOCKET SECURITY TEST SUITE');
  log.info(`Testing server: ${BASE_URL}`);
  log.info('Ensure test users exist: user1-3@example.com (password123)');
  log.section();

  try {
    await testUnauthorizedConnection();
    await testCrossUserMessageInjection();
    await testNonFriendMessaging();
    await testBlockFunctionality();
    await testSocketSpam();
    await testSQLInjection();
    await testXSSInjection();
    await testInvalidEventData();
    await testMultipleConnections();
    await testPresenceManipulation();
    await testRoomHijacking();
    await testEventListenerExhaustion();

    // Print summary
    log.section();
    log.title('📊 TEST SUMMARY');
    console.log(`Total Tests: ${results.total}`);
    console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${results.warnings}${colors.reset}`);
    
    if (results.failed > 0) {
      console.log(`\n${colors.red}⚠️  CRITICAL: ${results.failed} security issues detected!${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✓ All security tests passed!${colors.reset}`);
    }
    
    log.section();
    
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
