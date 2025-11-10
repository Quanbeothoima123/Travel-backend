// socket/index.js - Main Socket Setup
const socketIO = require("socket.io");
const conversationHandlers = require("./handlers/conversation.handler");
const messageHandlers = require("./handlers/message.handler");
const typingHandlers = require("./handlers/typing.handler");

const DOMAIN_WEBSITE = process.env.DOMAIN_WEBSITE || "http://localhost:3000";

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: DOMAIN_WEBSITE,
      credentials: true,
    },
  });

  // Middleware xác thực
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth.userId;
      if (!userId) {
        return next(new Error("Authentication error"));
      }
      socket.userId = userId;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Join user vào room riêng
    socket.join(`user:${socket.userId}`);

    // Register handlers
    conversationHandlers(io, socket);
    messageHandlers(io, socket);
    typingHandlers(io, socket);

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

module.exports = initializeSocket;
