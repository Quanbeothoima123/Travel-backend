// ========================================
// socket/handlers/typing.handler.js
// ========================================
module.exports = (io, socket) => {
  // Typing start
  socket.on("typing-start", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("user-typing", {
      userId: socket.userId,
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
