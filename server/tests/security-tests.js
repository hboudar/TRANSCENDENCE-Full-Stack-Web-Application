/**
 * Comprehensive Security & Stress Testing Suite
 * Tests authentication, authorization, malicious inputs, and server stability
 */

// Disable SSL verification for self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'https://localhost';
let validToken = null;
let validUserId = null;
let validToken2 = null;
let validUserId2 = null;

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${'='.repeat(80)}`);
  log(`🧪 ${testName}`, 'cyan');
  console.log('='.repeat(80));
}

function logResult(passed, message) {
  if (passed) {
    log(`✅ PASS: ${message}`, 'green');
  } else {
    log(`❌ FAIL: ${message}`, 'red');
  }
}

function logWarning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

// Helper function to make requests
async function makeRequest(endpoint, options = {}) {
  // Add /api prefix to all endpoints except /auth
  const apiPath = endpoint.startsWith('/auth') ? endpoint : `/api${endpoint}`;
  const url = `${BASE_URL}${apiPath}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    // Extract token from Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    let token = null;
    if (setCookie) {
      const tokenMatch = setCookie.match(/token=([^;]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
      }
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      data,
      ok: response.ok,
      token,
    };
  } catch (error) {
    return {
      status: 0,
      statusText: 'Network Error',
      data: { error: error.message },
      ok: false,
      error,
    };
  }
}

// ============================================================================
// 1. AUTHENTICATION TESTS
// ============================================================================
async function testAuthentication() {
  logTest('AUTHENTICATION & AUTHORIZATION TESTS');
  
  // Use pre-created verified test users
  log('\n📝 Test 1.1: Login with Pre-Verified Test Users', 'blue');
  log('NOTE: Run "node tests/prepare-test-users.js" first to create test users', 'yellow');
  
  const testUser1 = {
    email: 'security_test1@test.com',
    password: 'TestPass123!',
  };
  
  const testUser2 = {
    email: 'security_test2@test.com',
    password: 'TestPass456!',
  };
  const login1 = await makeRequest('/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testUser1.email,
      password: testUser1.password,
    }),
  });
  
  const login2 = await makeRequest('/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testUser2.email,
      password: testUser2.password,
    }),
  });
  
  if (login1.ok && login1.token) {
    validToken = login1.token;
    validUserId = login1.data.user.id;
    logResult(true, `User 1 login successful, token received`);
  } else {
    logResult(false, `User 1 login failed: ${login1.status} - ${JSON.stringify(login1.data)}`);
  }
  
  if (login2.ok && login2.token) {
    validToken2 = login2.token;
    validUserId2 = login2.data.user.id;
    logResult(true, `User 2 login successful, token received`);
  } else {
    logResult(false, `User 2 login failed: ${login2.status} - ${JSON.stringify(login2.data)}`);
  }
  
  // Test 1.3: Access protected endpoint without token
  log('\n📝 Test 1.3: Unauthorized Access (No Token)', 'blue');
  const unauth = await makeRequest('/me', { method: 'GET' });
  logResult(unauth.status === 401, `Protected endpoint without token: ${unauth.status} (expected 401)`);
  
  // Test 1.4: Access with invalid token
  log('\n📝 Test 1.4: Unauthorized Access (Invalid Token)', 'blue');
  const invalidToken = await makeRequest('/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer invalid_token_12345' },
  });
  logResult(invalidToken.status === 401, `Invalid token: ${invalidToken.status} (expected 401)`);
  
  // Test 1.5: Access with valid token
  log('\n📝 Test 1.5: Authorized Access (Valid Token)', 'blue');
  const authorized = await makeRequest('/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  logResult(authorized.status === 200, `Valid token access: ${authorized.status} (expected 200)`);
  
  // Test 1.6: Try SQL injection in login
  log('\n📝 Test 1.6: SQL Injection Attempts', 'blue');
  const sqlInjection = await makeRequest('/login', {
    method: 'POST',
    body: JSON.stringify({
      username: "admin' OR '1'='1",
      password: "' OR '1'='1",
    }),
  });
  logResult(sqlInjection.status === 401 || sqlInjection.status === 400, 
    `SQL injection blocked: ${sqlInjection.status}`);
}

// ============================================================================
// 2. AUTHORIZATION TESTS (User cannot access other users' resources)
// ============================================================================
async function testAuthorization() {
  logTest('CROSS-USER AUTHORIZATION TESTS');
  
  if (!validToken || !validToken2 || !validUserId || !validUserId2) {
    logWarning('Skipping authorization tests - need valid tokens from authentication tests');
    return;
  }
  
  // Test 2.1: User 1 tries to access User 2's messages
  log('\n📝 Test 2.1: Cross-User Message Access', 'blue');
  const crossUserMessages = await makeRequest(`/messages/${validUserId2}/${validUserId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` }, // User 1's token
  });
  // Should either succeed (if authorized) or fail with 403
  log(`Cross-user message access: ${crossUserMessages.status}`);
  
  // Test 2.2: Try to send friend request with manipulated user_id in body
  log('\n📝 Test 2.2: Friend Request Authorization', 'blue');
  const friendRequest = await makeRequest('/friends', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({
      user_id: validUserId, // User 1
      friend_id: validUserId2, // User 2
    }),
  });
  log(`Friend request: ${friendRequest.status}`);
  
  // Test 2.3: User 1 tries to access User 2's games
  log('\n📝 Test 2.3: Cross-User Game History', 'blue');
  const crossUserGames = await makeRequest(`/games/${validUserId2}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  log(`Cross-user game history: ${crossUserGames.status}`);
}

// ============================================================================
// 3. MALICIOUS INPUT TESTS
// ============================================================================
async function testMaliciousInputs() {
  logTest('MALICIOUS INPUT & INJECTION TESTS');
  
  if (!validToken) {
    logWarning('Skipping malicious input tests - need valid token');
    return;
  }
  
  // Test 3.1: XSS in message content
  log('\n📝 Test 3.1: XSS Payload in Messages', 'blue');
  const xssPayload = '<script>alert("XSS")</script>';
  const xssTest = await makeRequest('/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({
      sender_id: validUserId,
      receiver_id: validUserId2,
      content: xssPayload,
    }),
  });
  logResult(xssTest.ok || xssTest.status === 400, 
    `XSS payload handled: ${xssTest.status}`);
  
  // Test 3.2: Extremely long input
  log('\n📝 Test 3.2: Oversized Input', 'blue');
  const hugeString = 'A'.repeat(100000);
  const oversized = await makeRequest('/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({
      sender_id: validUserId,
      receiver_id: validUserId2,
      content: hugeString,
    }),
  });
  logResult(oversized.status === 400 || oversized.status === 413, 
    `Oversized input rejected: ${oversized.status}`);
  
  // Test 3.3: Null/undefined values
  log('\n📝 Test 3.3: Null/Undefined Values', 'blue');
  const nullTest = await makeRequest('/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: JSON.stringify({
      sender_id: null,
      receiver_id: undefined,
      content: null,
    }),
  });
  logResult(nullTest.status === 400, `Null values rejected: ${nullTest.status}`);
  
  // Test 3.4: Invalid JSON
  log('\n📝 Test 3.4: Malformed JSON', 'blue');
  const malformed = await makeRequest('/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
    body: '{invalid json}',
  });
  logResult(malformed.status === 400, `Malformed JSON rejected: ${malformed.status}`);
  
  // Test 3.5: NoSQL/SQL injection in search
  log('\n📝 Test 3.5: Injection in Search', 'blue');
  const searchInjection = await makeRequest('/search?search=$ne', {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  log(`Search injection handling: ${searchInjection.status}`);
}

// ============================================================================
// 4. STRESS TESTS
// ============================================================================
async function testStressLoad() {
  logTest('STRESS & LOAD TESTS');
  
  if (!validToken) {
    logWarning('Skipping stress tests - need valid token');
    return;
  }
  
  // Test 4.1: Rapid sequential requests
  log('\n📝 Test 4.1: Sequential Request Spam (50 requests)', 'blue');
  const start1 = Date.now();
  let successCount = 0;
  let rateLimited = 0;
  
  for (let i = 0; i < 50; i++) {
    const res = await makeRequest('/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${validToken}` },
    });
    if (res.status === 200) successCount++;
    if (res.status === 429) rateLimited++;
  }
  
  const duration1 = Date.now() - start1;
  log(`Sequential: ${successCount}/50 succeeded, ${rateLimited} rate-limited in ${duration1}ms`);
  logResult(rateLimited > 0, `Rate limiting active: ${rateLimited} requests blocked`);
  
  // Test 4.2: Concurrent requests
  log('\n📝 Test 4.2: Concurrent Request Spam (100 requests)', 'blue');
  const start2 = Date.now();
  const promises = Array(100).fill(null).map(() =>
    makeRequest('/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${validToken}` },
    })
  );
  
  const results = await Promise.allSettled(promises);
  const concurrent200 = results.filter(r => r.value?.status === 200).length;
  const concurrent429 = results.filter(r => r.value?.status === 429).length;
  const concurrentErrors = results.filter(r => r.status === 'rejected' || r.value?.status === 0).length;
  
  const duration2 = Date.now() - start2;
  log(`Concurrent: ${concurrent200}/100 succeeded, ${concurrent429} rate-limited, ${concurrentErrors} failed in ${duration2}ms`);
  logResult(concurrent429 > 0 || concurrentErrors > 0, 
    `Server handled concurrent load (${concurrent429} rate-limited, ${concurrentErrors} errors)`);
  
  // Test 4.3: Large payload spam
  log('\n📝 Test 4.3: Large Payload Stress (20 requests)', 'blue');
  const largePayload = 'X'.repeat(50000); // 50KB
  const start3 = Date.now();
  let largeSuccess = 0;
  let largeRejected = 0;
  
  for (let i = 0; i < 20; i++) {
    const res = await makeRequest('/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        sender_id: validUserId,
        receiver_id: validUserId2,
        content: largePayload,
      }),
    });
    if (res.ok) largeSuccess++;
    if (res.status === 400 || res.status === 413) largeRejected++;
  }
  
  const duration3 = Date.now() - start3;
  log(`Large payloads: ${largeSuccess} accepted, ${largeRejected} rejected in ${duration3}ms`);
  logResult(largeRejected > 0, `Large payload filtering active`);
}

// ============================================================================
// 5. ENDPOINT-SPECIFIC AUTHORIZATION CHECKS
// ============================================================================
async function testEndpointAuthorization() {
  logTest('ENDPOINT-SPECIFIC AUTHORIZATION AUDIT');
  
  if (!validToken) {
    logWarning('Skipping endpoint tests - need valid token');
    return;
  }
  
  const endpoints = [
    { method: 'GET', path: '/me', requiresAuth: true },
    { method: 'POST', path: '/logout', requiresAuth: true },
    { method: 'GET', path: '/friends/accepted', requiresAuth: true },
    { method: 'GET', path: '/friends/request', requiresAuth: true },
    { method: 'GET', path: '/notifications', requiresAuth: true },
    { method: 'GET', path: '/games', requiresAuth: true },
    { method: 'GET', path: '/player_skins', requiresAuth: true },
    { method: 'GET', path: '/selected_skins', requiresAuth: true },
    { method: 'GET', path: '/paddles', requiresAuth: true },
    { method: 'GET', path: '/balls', requiresAuth: true },
    { method: 'GET', path: '/tables', requiresAuth: true },
    { method: 'POST', path: '/profile', requiresAuth: true },
    { method: 'POST', path: '/blocks', requiresAuth: true },
    { method: 'GET', path: '/search?search=test', requiresAuth: true },
  ];
  
  log('\n📝 Testing Protected Endpoints Without Authorization', 'blue');
  
  for (const endpoint of endpoints) {
    const res = await makeRequest(endpoint.path, {
      method: endpoint.method,
    });
    
    if (endpoint.requiresAuth) {
      logResult(res.status === 401, 
        `${endpoint.method} ${endpoint.path}: ${res.status} (expected 401)`);
      if (res.status !== 401) {
        logWarning(`  ⚠️  SECURITY RISK: Endpoint is not properly protected!`);
      }
    }
  }
  
  log('\n📝 Testing Protected Endpoints With Valid Authorization', 'blue');
  
  for (const endpoint of endpoints) {
    const res = await makeRequest(endpoint.path, {
      method: endpoint.method,
      headers: { Authorization: `Bearer ${validToken}` },
    });
    
    if (endpoint.requiresAuth) {
      logResult(res.status === 200 || res.status === 201, 
        `${endpoint.method} ${endpoint.path}: ${res.status}`);
    }
  }
}

// ============================================================================
// 6. DATABASE FAILURE SIMULATION
// ============================================================================
async function testDatabaseFailures() {
  logTest('DATABASE ERROR HANDLING TESTS');
  
  if (!validToken) {
    logWarning('Skipping database tests - need valid token');
    return;
  }
  
  log('\n📝 Test 6.1: Check Error Status Codes', 'blue');
  log('Note: These tests check that proper error codes are returned (503, 422, 502)');
  log('Cannot easily simulate DB failures without stopping the database');
  
  // Test invalid user IDs (should trigger DB errors or 404)
  const invalidUserTest = await makeRequest('/games/999999', {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  
  log(`Invalid user ID request: ${invalidUserTest.status}`);
  logResult(invalidUserTest.status === 404 || invalidUserTest.status === 200, 
    `Handled invalid user ID appropriately`);
}

// ============================================================================
// 7. TOKEN SECURITY TESTS
// ============================================================================
async function testTokenSecurity() {
  logTest('TOKEN SECURITY TESTS');
  
  if (!validToken || !validUserId) {
    logWarning('Skipping token tests - need valid token');
    return;
  }
  
  // Test 7.1: Logout invalidates token
  log('\n📝 Test 7.1: Token Blacklisting After Logout', 'blue');
  const beforeLogout = await makeRequest('/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  logResult(beforeLogout.status === 200, `Token valid before logout: ${beforeLogout.status}`);
  
  const logout = await makeRequest('/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  logResult(logout.ok, `Logout successful: ${logout.status}`);
  
  const afterLogout = await makeRequest('/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  logResult(afterLogout.status === 401, 
    `Token blacklisted after logout: ${afterLogout.status} (expected 401)`);
  
  // Test 7.2: Expired token (we can't easily test this without manipulating time)
  log('\n📝 Test 7.2: Malformed Token', 'blue');
  const malformedToken = await makeRequest('/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid' },
  });
  logResult(malformedToken.status === 401, `Malformed token rejected: ${malformedToken.status}`);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  log('\n' + '█'.repeat(80), 'magenta');
  log('    🔒 COMPREHENSIVE SECURITY & STRESS TEST SUITE', 'magenta');
  log('█'.repeat(80) + '\n', 'magenta');
  
  const startTime = Date.now();
  
  try {
    await testAuthentication();
    await testAuthorization();
    await testMaliciousInputs();
    await testStressLoad();
    await testEndpointAuthorization();
    await testDatabaseFailures();
    await testTokenSecurity();
  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    console.error(error);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  log('\n' + '█'.repeat(80), 'magenta');
  log(`    ✅ TEST SUITE COMPLETED IN ${duration}s`, 'magenta');
  log('█'.repeat(80) + '\n', 'magenta');
  
  log('\n📊 SUMMARY & RECOMMENDATIONS:', 'cyan');
  log('1. Review any failed authorization tests - they may indicate security vulnerabilities');
  log('2. Check rate limiting effectiveness - too many requests should be blocked');
  log('3. Verify all protected endpoints return 401 for unauthorized access');
  log('4. Ensure malicious inputs are properly sanitized or rejected');
  log('5. Confirm proper HTTP status codes (503, 422, 502) for different error types');
  log('\n');
}

// Run tests
runAllTests().catch(console.error);
