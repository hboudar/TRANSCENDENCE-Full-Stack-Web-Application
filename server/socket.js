import jwt from 'jsonwebtoken';
import { checkFriendship, checkBlock } from './utils/friendshipHelper.js';

const SECRET = process.env.JWT_SECRET;

// Track connections per user (max 5 per user)
const userConnections = new Map();

const sockethandler = (io, db) => {
  // Authentication middleware - verify JWT before allowing connection
  io.use((socket, next) => {
    try {
      // Extract token from auth or cookies
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.cookie?.match(/token=([^;]+)/)?.[1];
      
      if (!token) {
        console.log('⚠️ Socket connection rejected: No token provided');
        return next(new Error('Authentication required'));
      }
      
      // SECURITY: Check if token is blacklisted (logout/revoked tokens)
      db.get('SELECT token FROM blacklist_tokens WHERE token = ?', [token], (err, blacklisted) => {
        if (err) {
          console.log('⚠️ Socket connection rejected: Database error checking blacklist');
          return next(new Error('Authentication failed'));
        }
        
        if (blacklisted) {
          console.log('⚠️ Socket connection rejected: Token is blacklisted');
          return next(new Error('Token has been revoked'));
        }
        
        // Verify JWT token
        let decoded;
        try {
          decoded = jwt.verify(token, SECRET);
        } catch (jwtError) {
          console.log('⚠️ Socket connection rejected: Invalid token', jwtError.message);
          return next(new Error('Invalid or expired token'));
        }
        
        const userId = decoded.userId;
        
        // SECURITY: Verify user exists in database (prevent deleted users from connecting)
        db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) {
            console.log('⚠️ Socket connection rejected: Database error');
            return next(new Error('Authentication failed'));
          }
          
          if (!user) {
            console.log(`⚠️ Socket connection rejected: User ${userId} not found in database`);
            return next(new Error('User not found'));
          }
          
          socket.userId = userId;
          
          // Check connection limit BEFORE allowing connection (prevents race conditions)
          const connections = userConnections.get(socket.userId) || 0;
          if (connections >= 5) {
            console.log(`🚫 User ${socket.userId} exceeded connection limit (${connections})`);
            return next(new Error('Too many concurrent connections'));
          }
          
          // Track this connection immediately
          userConnections.set(socket.userId, connections + 1);
          console.log(`✅ Socket authenticated for user ${socket.userId} (connections: ${connections + 1})`);
          next();
        });
      });
    } catch (error) {
      console.log('⚠️ Socket connection rejected: Unexpected error', error.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on("connection", (socket) => {
    console.log("⚡ Socket.IO client connected:", socket.id, "User:", socket.userId);

    socket.on("join", (userId) => {
      // Verify userId matches authenticated user
      if (socket.userId != userId) {
        console.log(`🚫 User ${socket.userId} attempted to join room for user ${userId}`);
        socket.emit('error', { message: 'Cannot join another user\'s room' });
        return;
      }

      const room = `user:${userId}`;
      socket.join(room);
      console.log(`🔗 User ${userId} joined room ${room}`);
      
      // Broadcast presence to all clients
      try {
        io.emit('user_presence', { userId, status: 'online' });
      } catch (e) {
        console.error('Error emitting user_presence', e);
      }
    });

    socket.on("chat message", async (msg) => {
      const { content, sender_id, receiver_id, status } = msg;

      // SECURITY: Verify sender_id matches authenticated user (prevent impersonation)
      if (socket.userId != sender_id) {
        console.log(`🚫 Message rejected: User ${socket.userId} attempted to send as ${sender_id}`);
        socket.emit('error', { message: 'Unauthorized: Cannot send messages as another user' });
        return;
      }

      // Validate required fields
      if (!sender_id || !receiver_id || !content) {
        console.log("🚫 Message rejected: Missing required fields");
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      // Validate content length (prevent spam/abuse)
      if (typeof content !== 'string' || content.length > 10000) {
        console.log("🚫 Message rejected: Invalid content");
        socket.emit('error', { message: 'Invalid message content' });
        return;
      }

      if (!status) {
        console.log("🚫 Skipping offline message attempt:", msg);
        return; // Ignore messages sent without connection
      }

      console.log("📩 Received message:", msg);

      try {
        // Check if sender is blocked by receiver OR receiver is blocked by sender
        const block = await checkBlock(db, sender_id, receiver_id);
        if (block) {
          const isBlocker = block.blocker_id == sender_id;
          const blockMessage = isBlocker 
            ? "You have blocked this user. Unblock them to send messages." 
            : "You cannot send messages to this user.";
          
          console.log(`🚫 Message blocked: User ${sender_id} → ${receiver_id} (${isBlocker ? 'sender blocked receiver' : 'sender is blocked'})`);
          
          socket.emit("message_blocked", {
            sender_id,
            receiver_id,
            message: blockMessage,
            reason: 'blocked'
          });
          return;
        }

        // Check if users are friends
        const areFriends = await checkFriendship(db, sender_id, receiver_id);
        if (!areFriends) {
          console.log("🚫 Users are not friends", sender_id, receiver_id);
          socket.emit("message_blocked", {
            sender_id,
            receiver_id,
            message: "You can only send messages to friends. Send a friend request first.",
            reason: 'not_friends'
          });
          return;
        }

        // Users are friends and not blocked, insert message
        db.run(
          `INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
          [sender_id, receiver_id, content],
          function (err) {
            if (err) {
              console.error("❌ Error inserting message:", err.message);
              return;
            }

            const messageData = {
              id: this.lastID,
              content,
              sender_id,
              receiver_id,
              status: true,
              created_at: new Date().toISOString(),
            };
           
            io.to(`user:${sender_id}`).emit("new message", messageData);
            io.to(`user:${receiver_id}`).emit("new message", messageData);
          }
        );
      } catch (error) {
        console.error("❌ Error in chat message handler:", error);
      }
    });

    // Respond with list of currently connected user IDs
    socket.on('request_online_users', () => {
      try {
        const sockets = Array.from(io.sockets.sockets.values());
        const userIds = sockets
          .map(s => s.userId)
          .filter(id => typeof id !== 'undefined' && id !== null);
        // unique
        const unique = Array.from(new Set(userIds));
        socket.emit('online_users', unique);
      } catch (err) {
        console.error('Error getting online users', err);
        socket.emit('online_users', []);
      }
    });

    socket.on("send_game_invite", async ({ recipientId, gameType }) => {
      const senderId = socket.userId;
      
      if (!senderId) {
        console.error("❌ No userId found on socket for game invite");
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      // Validate input
      if (!recipientId || !gameType) {
        console.log("🚫 Game invite rejected: Missing required fields");
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      // Validate recipientId is a number
      if (typeof recipientId !== 'number' && isNaN(parseInt(recipientId))) {
        console.log("🚫 Game invite rejected: Invalid recipient ID");
        socket.emit('error', { message: 'Invalid recipient ID' });
        return;
      }

      // SECURITY: Check if users are friends before allowing game invite
      try {
        const areFriends = await checkFriendship(db, senderId, recipientId);
        if (!areFriends) {
          console.log(`🚫 Game invite rejected: Users ${senderId} and ${recipientId} are not friends`);
          socket.emit('error', { message: 'Can only invite friends to games' });
          return;
        }

        // Check if sender is blocked
        const block = await checkBlock(db, senderId, recipientId);
        if (block) {
          console.log(`🚫 Game invite rejected: User blocked`);
          socket.emit('error', { message: 'Cannot send game invite' });
          return;
        }
      } catch (error) {
        console.error("❌ Error checking friendship/block status:", error);
        socket.emit('error', { message: 'Failed to send game invite' });
        return;
      }

      console.log(`🎮 Game invite from ${senderId} to ${recipientId} for ${gameType}`);

      db.get("SELECT name, picture FROM users WHERE id = ?", [senderId], (err, sender) => {
        if (err || !sender) {
          console.error("❌ Error fetching sender info:", err);
          return;
        }

        const message = `${sender.name} invited you to play ${gameType}!`;
        const data = JSON.stringify({ gameType, senderId });

        // Save notification to database
        db.run(
          `INSERT INTO notifications (user_id, sender_id, type, message, data) 
           VALUES (?, ?, 'game_invite', ?, ?)`,
          [recipientId, senderId, message, data],
          function (err) {
            if (err) {
              console.error("❌ Error creating notification:", err);
              return;
            }

            const notification = {
              id: this.lastID,
              user_id: recipientId,
              sender_id: senderId,
              type: "game_invite",
              message,
              data,
              is_read: 0,
              created_at: new Date().toISOString(),
              sender_name: sender.name,
              sender_picture: sender.picture,
            };

            // Send real-time notification to recipient
            io.to(`user:${recipientId}`).emit("new_notification", notification);
            console.log(`✅ Notification sent to user ${recipientId}`);

            // Confirm to sender
            socket.emit("game_invite_sent", { success: true, recipientId });
          }
        );
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id, "User:", socket.userId);
      
      // Decrease connection count for this user
      if (socket.userId) {
        const connections = userConnections.get(socket.userId) || 1;
        const newCount = connections - 1;
        
        if (newCount <= 0) {
          userConnections.delete(socket.userId);
          console.log(`📊 User ${socket.userId} has no more connections`);
          // Broadcast offline presence
          io.emit('user_presence', { userId: socket.userId, status: 'offline' });
        } else {
          userConnections.set(socket.userId, newCount);
          console.log(`📊 User ${socket.userId} connection count: ${newCount}`);
        }
      }
    });

    // Re-broadcast profile updates received from clients so other sockets can update UI
    socket.on('profile_updated', (payload) => {
      try {
        const { userId, name, picture } = payload || {};
        
        // SECURITY: Verify userId matches authenticated user (prevent profile spoofing)
        if (socket.userId != userId) {
          console.log(`🚫 Profile update rejected: User ${socket.userId} attempted to update profile for ${userId}`);
          socket.emit('error', { message: 'Unauthorized: Cannot update another user\'s profile' });
          return;
        }
        
        console.log('🔁 Received profile_updated from client:', payload);
        // Broadcast to all other clients so they can refresh headers/avatars
        socket.broadcast.emit('user_profile_updated', { userId, name, picture });
        // Also emit to the user's own room so their other sessions/devices receive it
        if (userId) {
          io.to(`user:${userId}`).emit('user_profile_updated', { userId, name, picture });
        }
      } catch (err) {
        console.error('Error handling profile_updated', err);
      }
    });

    // Send friend request
    socket.on("friends:request:send", ({ fromUserId, toUserId }) => {
      // SECURITY: Verify fromUserId matches authenticated user
      if (socket.userId != fromUserId) {
        console.log(`🚫 Friend request rejected: User ${socket.userId} attempted to send as ${fromUserId}`);
        socket.emit('error', { message: 'Unauthorized: Cannot send friend request as another user' });
        return;
      }

      // Validate input
      if (!toUserId) {
        console.log("🚫 Friend request rejected: Missing recipient");
        socket.emit('error', { message: 'Missing recipient' });
        return;
      }

      console.log(`📨 Friend request sent from ${fromUserId} → ${toUserId}`);

      io.to(`user:${toUserId}`).emit("friends:request:incoming", {
        fromUserId
      });
    });

    // When friend request accepted or removed
    socket.on("friends:update", ({ userA, userB }) => {
      // SECURITY: Verify authenticated user is one of the parties
      if (socket.userId != userA && socket.userId != userB) {
        console.log(`🚫 Friends update rejected: User ${socket.userId} not involved in ${userA} & ${userB}`);
        socket.emit('error', { message: 'Unauthorized: Not part of this friendship' });
        return;
      }

      console.log(`🔄 Friends updated between ${userA} & ${userB}`);
      io.to(`user:${userA}`).emit("friends:updated");
      io.to(`user:${userB}`).emit("friends:updated");
    });

    // Handle block event and broadcast to both users
    socket.on('user_blocked', (data) => {
      const { blocker_id, blocked_id } = data;
      
      // SECURITY: Verify blocker_id matches authenticated user
      if (socket.userId != blocker_id) {
        console.log(`🚫 Block rejected: User ${socket.userId} attempted to block as ${blocker_id}`);
        socket.emit('error', { message: 'Unauthorized: Cannot block as another user' });
        return;
      }

      // Validate input
      if (!blocked_id) {
        console.log("🚫 Block rejected: Missing blocked user ID");
        socket.emit('error', { message: 'Missing blocked user ID' });
        return;
      }

      console.log(`🚫 User ${blocker_id} blocked user ${blocked_id}`);
      // Notify both users
      io.to(`user:${blocker_id}`).emit('user_blocked', data);
      io.to(`user:${blocked_id}`).emit('user_blocked', data);
    });

    // Handle unblock event and broadcast to both users
    socket.on('user_unblocked', (data) => {
      const { blocker_id, blocked_id } = data;
      
      // SECURITY: Verify blocker_id matches authenticated user
      if (socket.userId != blocker_id) {
        console.log(`🚫 Unblock rejected: User ${socket.userId} attempted to unblock as ${blocker_id}`);
        socket.emit('error', { message: 'Unauthorized: Cannot unblock as another user' });
        return;
      }

      // Validate input
      if (!blocked_id) {
        console.log("🚫 Unblock rejected: Missing blocked user ID");
        socket.emit('error', { message: 'Missing blocked user ID' });
        return;
      }

      console.log(`✅ User ${blocker_id} unblocked user ${blocked_id}`);
      // Notify both users
      io.to(`user:${blocker_id}`).emit('user_unblocked', data);
      io.to(`user:${blocked_id}`).emit('user_unblocked', data);
    });

  });
};

export { sockethandler }