// ========================================
// socket/handlers/typing.handler.js
// ========================================
module.exports = (io, socket) => {
  // Typing start - Forward userInfo đến các client khác
  socket.on("typing-start", ({ conversationId, userInfo }) => {
    socket.to(`conversation:${conversationId}`).emit("user-typing", {
      userId: socket.userId,
      userInfo, //  Chuyển tiếp thông tin user
      conversationId,
    });
  });

  // Typing stop
  socket.on("typing-stop", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("user-stop-typing", {
      userId: socket.userId,
      conversationId,
    });
  });
};
