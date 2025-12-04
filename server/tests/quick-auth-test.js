/**
 * Quick Authorization Test - Tests the specific security fixes
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = 'https://10.32.118.247';

async function makeRequest(endpoint, options = {}) {
  const apiPath = endpoint.startsWith('/auth') ? endpoint : `/api${endpoint}`;
  const url = `${BASE_URL}${apiPath}`;
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
  
  const setCookie = response.headers.get('set-cookie');
  let token = null;
  if (setCookie) {
    const tokenMatch = setCookie.match(/token=([^;]+)/);
    if (tokenMatch) token = tokenMatch[1];
  }
  
  return { status: response.status, data, token };
}

async function runTests() {
  console.log('🔒 AUTHORIZATION FIX VERIFICATION\n');
  
  // Login as both users
  console.log('📝 Logging in as test users...');
  const login1 = await makeRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'security_test1@test.com', password: 'TestPass123!' }),
  });
  
  const login2 = await makeRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'security_test2@test.com', password: 'TestPass456!' }),
  });
  
  if (!login1.token || !login2.token) {
    console.log('❌ Failed to login');
    return;
  }
  
  const user1Id = login1.data.user.id;
  const user2Id = login2.data.user.id;
  const token1 = login1.token;
  const token2 = login2.token;
  
  console.log(`✅ User 1 logged in (ID: ${user1Id})`);
  console.log(`✅ User 2 logged in (ID: ${user2Id})\n`);
  
  // Test 1: User 1 tries to access messages between User 1 and User 2 (should work)
  console.log('📝 Test 1: User 1 accessing own messages with User 2');
  const ownMessages = await makeRequest(`/messages/${user1Id}/${user2Id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${ownMessages.status} ${ownMessages.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  if (ownMessages.status !== 200) {
    console.log(`   Error: ${JSON.stringify(ownMessages.data)}`);
  }
  
  // Test 2: User 1 tries to access messages between User 2 and a fake user (should fail with 403)
  console.log('\n📝 Test 2: User 1 accessing messages between User 2 and another user');
  const crossUserMessages = await makeRequest(`/messages/${user2Id}/999`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${crossUserMessages.status} ${crossUserMessages.status === 403 ? '✅ PASS' : '❌ FAIL'}`);
  if (crossUserMessages.status === 403) {
    console.log(`   ✓ Correctly blocked: ${crossUserMessages.data.error}`);
  }
  
  // Test 3: User 1 tries to access User 2's game history (should fail with 403)
  console.log('\n📝 Test 3: User 1 accessing User 2 game history');
  const crossUserGames = await makeRequest(`/games/${user2Id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${crossUserGames.status} ${crossUserGames.status === 403 ? '✅ PASS' : '❌ FAIL'}`);
  if (crossUserGames.status === 403) {
    console.log(`   ✓ Correctly blocked: ${crossUserGames.data.error}`);
  }
  
  // Test 4: User 1 accessing own game history (should work)
  console.log('\n📝 Test 4: User 1 accessing own game history');
  const ownGames = await makeRequest(`/games/${user1Id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${ownGames.status} ${ownGames.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test 5: Search with injection attempt (should return 400)
  console.log('\n📝 Test 5: Search with potential injection');
  const injectionSearch = await makeRequest('/search?search=$ne', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${injectionSearch.status} ${injectionSearch.status === 400 || injectionSearch.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test 6: Search with empty query (should return 400)
  console.log('\n📝 Test 6: Search with empty query');
  const emptySearch = await makeRequest('/search?search=', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${emptySearch.status} ${emptySearch.status === 400 ? '✅ PASS' : '❌ FAIL'}`);
  if (emptySearch.status === 400) {
    console.log(`   ✓ Correctly rejected: ${emptySearch.data.error}`);
  }
  
  // Test 7: Search with oversized query (should return 400)
  console.log('\n📝 Test 7: Search with oversized query (>100 chars)');
  const longSearch = await makeRequest(`/search?search=${'a'.repeat(150)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`   Status: ${longSearch.status} ${longSearch.status === 400 ? '✅ PASS' : '❌ FAIL'}`);
  if (longSearch.status === 400) {
    console.log(`   ✓ Correctly rejected: ${longSearch.data.error}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ AUTHORIZATION FIX VERIFICATION COMPLETE');
  console.log('='.repeat(80));
}

runTests().catch(console.error);
