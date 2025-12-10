// socket/index.js - Main Socket Setup
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const conversationHandlers = require("./handlers/conversation.handler");
const messageHandlers = require("./handlers/message.handler");
const typingHandlers = require("./handlers/typing.handler");
const presenceHandler = require("./handlers/presence.handler");
const adminHandlers = require("./handlers/admin.handler");
const supportHandlers = require("./handlers/support.handler"); // ✅ NEW - Support chat

const DOMAIN_WEBSITE = process.env.DOMAIN_WEBSITE || "http://localhost:3000";
const DOMAIN_WEBSITE_ADMIN =
  process.env.DOMAIN_WEBSITE_ADMIN || "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET;

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: [DOMAIN_WEBSITE, DOMAIN_WEBSITE_ADMIN],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ✅ MIDDLEWARE XÁC THỰC - Hỗ trợ CẢ USER + ADMIN
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const userId = socket.handshake.auth.userId;
      const userType = socket.handshake.auth.userType; // ✅ NEW - "user" or "admin"

      console.log("🔍 Socket auth attempt:", {
        hasToken: !!token,
        hasUserId: !!userId,
        userType,
      });

      // ✅ CASE 1: ADMIN (có token JWT)
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const adminId = decoded.id || decoded._id || decoded.adminId;

          if (!adminId) {
            console.error("❌ Invalid token structure:", decoded);
            return next(new Error("Authentication error: Invalid token"));
          }

          socket.adminId = adminId;
          socket.userRole = "admin";
          console.log(`✅ Admin authenticated: ${adminId}`);
          return next();
        } catch (err) {
          console.error("❌ Token verification failed:", err.message);
          return next(new Error(`Authentication error: ${err.message}`));
        }
      }

      // ✅ CASE 2: USER CHAT (có userId)
      if (userId) {
        socket.userId = userId;
        socket.userRole = userType || "user"; // ✅ Lấy từ auth
        console.log(
          `✅ User authenticated: ${userId} (Type: ${socket.userRole})`
        );
        return next();
      }

      // ❌ CASE 3: Không có gì
      console.error("❌ No authentication provided");
      return next(new Error("Authentication error: No credentials"));
    } catch (error) {
      console.error("❌ Auth middleware error:", error);
      next(new Error("Authentication error"));
    }
  });

  // ✅ CONNECTION HANDLER
  io.on("connection", (socket) => {
    const role = socket.userRole;
    const id = socket.adminId || socket.userId;

    console.log(`✅ Client connected: ${id} (Role: ${role})`);

    // ✅ ADMIN LOGIC
    if (role === "admin") {
      socket.join("admin-room");
      console.log(`✅ Admin ${socket.adminId} joined admin-room`);

      socket.emit("room-joined", {
        status: "success",
        message: "Joined admin room",
        room: "admin-room",
        adminId: socket.adminId,
      });

      // Register admin handlers
      adminHandlers(io, socket);
      supportHandlers(io, socket); // ✅ Admin cũng cần support handler
    }

    // ✅ USER CHAT LOGIC
    if (role === "user") {
      socket.join(`user:${socket.userId}`);
      console.log(`✅ User ${socket.userId} joined user:${socket.userId} room`);

      // Register user chat handlers
      conversationHandlers(io, socket);
      messageHandlers(io, socket);
      typingHandlers(io, socket);
      presenceHandler(io, socket);
      supportHandlers(io, socket); // ✅ User support handler
    }

    // ✅ DISCONNECT
    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${id} (Role: ${role})`);
    });
  });

  return io;
}

module.exports = initializeSocket;
