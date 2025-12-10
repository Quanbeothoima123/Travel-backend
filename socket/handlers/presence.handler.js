// ========================================
// socket/handlers/presence.handler.js (NEW)
// ========================================
const User = require("../../api/v1/models/user.model");
const Conversation = require("../../api/v1/models/conversation.model");

// Map lưu trạng thái online của users
const onlineUsers = new Map();

module.exports = (io, socket) => {
  // ========================================
  // 🟢 USER COMES ONLINE
  // ========================================
  socket.on("user-online", async () => {
    try {
      const userId = socket.userId;

      // Thêm vào Map
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      // Update DB
      await User.findByIdAndUpdate(userId, {
        lastOnline: new Date(),
        isOnline: true,
      });

      // Tìm tất cả conversations của user
      const conversations = await Conversation.find({
        "participants.userId": userId,
      }).lean();

      // Thông báo cho tất cả participants trong conversations
      const notifiedUsers = new Set();

      conversations.forEach((conv) => {
        conv.participants.forEach((p) => {
          const participantId = p.userId.toString();
          if (
            participantId !== userId.toString() &&
            !notifiedUsers.has(participantId)
          ) {
            notifiedUsers.add(participantId);
            io.to(`user:${participantId}`).emit("user-status-changed", {
              userId,
              isOnline: true,
              lastOnline: new Date(),
            });
          }
        });
      });

      console.log(`🟢 User ${userId} is online`);
    } catch (error) {
      console.error("User online error:", error);
    }
  });

  // ========================================
  // 🔴 USER GOES OFFLINE
  // ========================================
  socket.on("disconnect", async () => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      // Xóa socket khỏi Map
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);

        // Nếu không còn socket nào của user này -> offline
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);

          // Update DB
          await User.findByIdAndUpdate(userId, {
            lastOnline: new Date(),
            isOnline: false,
          });

          // Tìm tất cả conversations
          const conversations = await Conversation.find({
            "participants.userId": userId,
          }).lean();

          // Thông báo cho participants
          const notifiedUsers = new Set();

          conversations.forEach((conv) => {
            conv.participants.forEach((p) => {
              const participantId = p.userId.toString();
              if (
                participantId !== userId.toString() &&
                !notifiedUsers.has(participantId)
              ) {
                notifiedUsers.add(participantId);
                io.to(`user:${participantId}`).emit("user-status-changed", {
                  userId,
                  isOnline: false,
                  lastOnline: new Date(),
                });
              }
            });
          });

          console.log(`🔴 User ${userId} is offline`);
        }
      }
    } catch (error) {
      console.error("User disconnect error:", error);
    }
  });

  // ========================================
  // 📊 GET ONLINE STATUS
  // ========================================
  socket.on("get-online-status", (userIds, callback) => {
    try {
      const statuses = {};
      userIds.forEach((userId) => {
        statuses[userId] = onlineUsers.has(userId.toString());
      });
      callback(statuses);
    } catch (error) {
      console.error("Get online status error:", error);
      callback({});
    }
  });
};

// Export Map để dùng ở nơi khác
module.exports.onlineUsers = onlineUsers;
