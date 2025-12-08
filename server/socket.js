import jwt from 'jsonwebtoken';
import { checkFriendship, checkBlock } from './utils/friendshipHelper.js';

const SECRET = process.env.JWT_SECRET;


const userConnections = new Map();

const sockethandler = (io, db) => {
  
  io.use((socket, next) => {
    try {
      
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.cookie?.match(/token=([^;]+)/)?.[1];
      
      if (!token) {
        console.log('⚠️ Socket connection rejected: No token provided');
        return next(new Error('Authentication required'));
      }
      
      
      db.get('SELECT token FROM blacklist_tokens WHERE token = ?', [token], (err, blacklisted) => {
        if (err) {
          console.log('⚠️ Socket connection rejected: Database error checking blacklist');
          return next(new Error('Authentication failed'));
        }
        
        if (blacklisted) {
          console.log('⚠️ Socket connection rejected: Token is blacklisted');
          return next(new Error('Token has been revoked'));
        }
        
        
        let decoded;
        try {
          decoded = jwt.verify(token, SECRET);
        } catch (jwtError) {
          console.log('⚠️ Socket connection rejected: Invalid token', jwtError.message);
          return next(new Error('Invalid or expired token'));
        }
        
        const userId = decoded.userId;
        
        
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
          
          
          const connections = userConnections.get(socket.userId) || 0;
          if (connections >= 5) {
            console.log(`🚫 User ${socket.userId} exceeded connection limit (${connections})`);
            return next(new Error('Too many concurrent connections'));
          }
          
          
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
      
      if (socket.userId != userId) {
        console.log(`🚫 User ${socket.userId} attempted to join room for user ${userId}`);
        socket.emit('error', { message: 'Cannot join another user\'s room' });
        return;
      }

      const room = `user:${userId}`;
      socket.join(room);
      console.log(`🔗 User ${userId} joined room ${room}`);
      
      
      try {
        io.emit('user_presence', { userId, status: 'online' });
      } catch (e) {
        console.error('Error emitting user_presence', e);
      }
    });

    socket.on("chat message", async (msg) => {
      const { content, sender_id, receiver_id, status } = msg;

      
      if (socket.userId != sender_id) {
        console.log(`🚫 Message rejected: User ${socket.userId} attempted to send as ${sender_id}`);
        socket.emit('error', { message: 'Unauthorized: Cannot send messages as another user' });
        return;
      }

      
      if (!sender_id || !receiver_id || !content) {
        console.log("🚫 Message rejected: Missing required fields");
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      
      if (typeof content !== 'string' || content.length > 10000) {
        console.log("🚫 Message rejected: Invalid content");
        socket.emit('error', { message: 'Invalid message content' });
        return;
      }

      if (!status) {
        console.log("🚫 Skipping offline message attempt:", msg);
        return; 
      }

      console.log("📩 Received message:", msg);

      try {
        
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

    
    socket.on('request_online_users', () => {
      try {
        const sockets = Array.from(io.sockets.sockets.values());
        const userIds = sockets
          .map(s => s.userId)
          .filter(id => typeof id !== 'undefined' && id !== null);
        
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

      
      if (!recipientId || !gameType) {
        console.log("🚫 Game invite rejected: Missing required fields");
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      
      if (typeof recipientId !== 'number' && isNaN(parseInt(recipientId))) {
        console.log("🚫 Game invite rejected: Invalid recipient ID");
        socket.emit('error', { message: 'Invalid recipient ID' });
        return;
      }

      
      try {
        const areFriends = await checkFriendship(db, senderId, recipientId);
        if (!areFriends) {
          console.log(`🚫 Game invite rejected: Users ${senderId} and ${recipientId} are not friends`);
          socket.emit('error', { message: 'Can only invite friends to games' });
          return;
        }

        
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

            
            io.to(`user:${recipientId}`).emit("new_notification", notification);
            console.log(`✅ Notification sent to user ${recipientId}`);

            
            socket.emit("game_invite_sent", { success: true, recipientId });
          }
        );
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id, "User:", socket.userId);
      
      
      if (socket.userId) {
        const connections = userConnections.get(socket.userId) || 1;
        const newCount = connections - 1;
        
        if (newCount <= 0) {
          userConnections.delete(socket.userId);
          console.log(`📊 User ${socket.userId} has no more connections`);
          
          io.emit('user_presence', { userId: socket.userId, status: 'offline' });
        } else {
          userConnections.set(socket.userId, newCount);
          console.log(`📊 User ${socket.userId} connection count: ${newCount}`);
        }
      }
    });

    
    socket.on('profile_updated', (payload) => {
      try {
        const { userId, name, picture } = payload || {};
        
        
        if (socket.userId != userId) {
          console.log(`🚫 Profile update rejected: User ${socket.userId} attempted to update profile for ${userId}`);
          socket.emit('error', { message: 'Unauthorized: Cannot update another user\'s profile' });
          return;
        }
        
        console.log('🔁 Received profile_updated from client:', payload);
        
        socket.broadcast.emit('user_profile_updated', { userId, name, picture });
        
        if (userId) {
          io.to(`user:${userId}`).emit('user_profile_updated', { userId, name, picture });
        }
      } catch (err) {
        console.error('Error handling profile_updated', err);
      }
    });

    
    socket.on("friends:request:send", ({ fromUserId, toUserId }) => {
      
      if (socket.userId != fromUserId) {
        console.log(`🚫 Friend request rejected: User ${socket.userId} attempted to send as ${fromUserId}`);
        socket.emit('error', { message: 'Unauthorized: Cannot send friend request as another user' });
        return;
      }

      
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

    
    socket.on("friends:update", ({ userA, userB }) => {
      
      if (socket.userId != userA && socket.userId != userB) {
        console.log(`🚫 Friends update rejected: User ${socket.userId} not involved in ${userA} & ${userB}`);
        socket.emit('error', { message: 'Unauthorized: Not part of this friendship' });
        return;
      }

      console.log(`🔄 Friends updated between ${userA} & ${userB}`);
      io.to(`user:${userA}`).emit("friends:updated");
      io.to(`user:${userB}`).emit("friends:updated");
    });

    
    socket.on('user_blocked', (data) => {
      const { blocker_id, blocked_id } = data;
      
      
      if (socket.userId != blocker_id) {
        console.log(`🚫 Block rejected: User ${socket.userId} attempted to block as ${blocker_id}`);
        socket.emit('error', { message: 'Unauthorized: Cannot block as another user' });
        return;
      }

      
      if (!blocked_id) {
        console.log("🚫 Block rejected: Missing blocked user ID");
        socket.emit('error', { message: 'Missing blocked user ID' });
        return;
      }

      console.log(`🚫 User ${blocker_id} blocked user ${blocked_id}`);
      
      io.to(`user:${blocker_id}`).emit('user_blocked', data);
      io.to(`user:${blocked_id}`).emit('user_blocked', data);
    });

    
    socket.on('user_unblocked', (data) => {
      const { blocker_id, blocked_id } = data;
      
      
      if (socket.userId != blocker_id) {
        console.log(`🚫 Unblock rejected: User ${socket.userId} attempted to unblock as ${blocker_id}`);
        socket.emit('error', { message: 'Unauthorized: Cannot unblock as another user' });
        return;
      }

      
      if (!blocked_id) {
        console.log("🚫 Unblock rejected: Missing blocked user ID");
        socket.emit('error', { message: 'Missing blocked user ID' });
        return;
      }

      console.log(`✅ User ${blocker_id} unblocked user ${blocked_id}`);
      
      io.to(`user:${blocker_id}`).emit('user_unblocked', data);
      io.to(`user:${blocked_id}`).emit('user_unblocked', data);
    });

  });
};

export { sockethandler }