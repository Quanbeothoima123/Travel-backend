// ========================================
// socket/handlers/conversation.handler.js
// ========================================
const Conversation = require("../../api/v1/models/conversation.model");

module.exports = (io, socket) => {
  // Join conversation room
  socket.on("join-conversation", async (conversationId) => {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        "participants.userId": socket.userId,
      });

      if (conversation) {
        socket.join(`conversation:${conversationId}`);
        console.log(
          `User ${socket.userId} joined conversation ${conversationId}`
        );
      }
    } catch (error) {
      console.error("Join conversation error:", error);
    }
  });

  // Leave conversation room
  socket.on("leave-conversation", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`User ${socket.userId} left conversation ${conversationId}`);
  });

  // ✅ NEW: Join user room để nhận conversation updates
  socket.on("join-user-room", (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined personal room for sidebar updates`);
  });
};
