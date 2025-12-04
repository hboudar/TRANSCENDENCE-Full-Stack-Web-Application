import fetch from 'node-fetch';

const SERVER_URL = 'http://10.32.118.247:3000';

const users = [
  { email: 'testuser1@test.com', username: 'testuser1', password: 'Test123!@#' },
  { email: 'testuser2@test.com', username: 'testuser2', password: 'Test123!@#' },
  { email: 'testuser3@test.com', username: 'testuser3', password: 'Test123!@#' }
];

async function registerUser(user) {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`❌ Failed to register ${user.email}: ${error}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Registered ${user.email} (ID: ${data.user?.id || 'unknown'})`);
    return data.user;
  } catch (error) {
    console.log(`❌ Failed to register ${user.email}: ${error.message}`);
    return null;
  }
}

async function loginUser(email, password) {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      return null;
    }
    
    const setCookieHeader = response.headers.get('set-cookie');
    const tokenMatch = setCookieHeader?.match(/token=([^;]+)/);
    
    const data = await response.json();
    return { token: tokenMatch?.[1], userId: data.user.id };
  } catch (error) {
    return null;
  }
}

async function verifyEmail(userId, token) {
  try {
    const response = await fetch(`${SERVER_URL}/api/dev/verify-user/${userId}`, {
      method: 'POST',
      headers: {
        'Cookie': `token=${token}`
      }
    });
    
    if (response.ok) {
      console.log(`✅ Verified email for user ID ${userId}`);
    }
  } catch (error) {
    console.log(`❌ Failed to verify user ${userId}`);
  }
}

async function sendFriendRequest(fromToken, fromUserId, toUserId) {
  try {
    const response = await fetch(`${SERVER_URL}/api/friends/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${fromToken}`
      },
      body: JSON.stringify({ friendId: toUserId })
    });
    
    if (response.ok) {
      console.log(`✅ Friend request sent from ${fromUserId} to ${toUserId}`);
      return true;
    }
  } catch (error) {
    console.log(`❌ Failed to send friend request: ${error.message}`);
  }
  return false;
}

async function acceptFriendRequest(accepterToken, requesterId) {
  try {
    const response = await fetch(`${SERVER_URL}/api/friends/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${accepterToken}`
      },
      body: JSON.stringify({ friendId: requesterId })
    });
    
    if (response.ok) {
      console.log(`✅ Friend request accepted`);
      return true;
    }
  } catch (error) {
    console.log(`❌ Failed to accept friend request: ${error.message}`);
  }
  return false;
}

async function main() {
  console.log('🔧 Setting up advanced test users...\n');
  
  // Register users
  const registeredUsers = [];
  for (const user of users) {
    const registered = await registerUser(user);
    if (registered) {
      registeredUsers.push({ ...user, id: registered.id });
    }
  }
  
  console.log('\n📧 Verifying emails...\n');
  
  // Login and verify emails
  const userTokens = [];
  for (const user of registeredUsers) {
    const loginData = await loginUser(user.email, user.password);
    if (loginData) {
      await verifyEmail(loginData.userId, loginData.token);
      userTokens.push({ ...user, token: loginData.token, userId: loginData.userId });
    }
  }
  
  if (userTokens.length >= 2) {
    console.log('\n🤝 Creating friendships...\n');
    
    // Make user1 and user2 friends
    const sent = await sendFriendRequest(userTokens[0].token, userTokens[0].userId, userTokens[1].userId);
    if (sent) {
      await acceptFriendRequest(userTokens[1].token, userTokens[0].userId);
    }
    
    // Make user1 and user3 friends
    if (userTokens.length >= 3) {
      const sent2 = await sendFriendRequest(userTokens[0].token, userTokens[0].userId, userTokens[2].userId);
      if (sent2) {
        await acceptFriendRequest(userTokens[2].token, userTokens[0].userId);
      }
    }
  }
  
  console.log('\n✅ Advanced test environment ready!\n');
}

main().catch(console.error);
