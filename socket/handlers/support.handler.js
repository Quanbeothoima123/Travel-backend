// socket/handlers/support.handler.js - SIMPLIFIED VERSION
const SupportConversation = require("../../api/v1/models/support-conversation.model");
const SupportMessage = require("../../api/v1/models/support-message.model");

module.exports = (io, socket) => {
  const userId = socket.userId;
  const adminId = socket.adminId;
  const userRole = socket.userRole;

  console.log(
    `📝 Support handler registered for ${userRole}: ${userId || adminId}`
  );

  // ==================== JOIN ROOM ====================
  socket.on("join-support-room", async (conversationId) => {
    try {
      console.log(`🚪 ${userRole} joining room: ${conversationId}`);

      // Verify quyền truy cập
      const conversation = await SupportConversation.findById(conversationId);

      if (!conversation) {
        return socket.emit("support-error", {
          message: "Conversation not found",
        });
      }

      // Verify quyền
      if (userRole === "user" && conversation.user.toString() !== userId) {
        return socket.emit("support-error", { message: "Access denied" });
      }

      // Join room
      socket.join(`support:${conversationId}`);
      socket.currentSupportRoom = conversationId;

      console.log(`✅ ${userRole} joined support:${conversationId}`);

      // Thông báo cho người khác trong room
      socket.to(`support:${conversationId}`).emit("user-joined-room", {
        userType: userRole,
        userId: userId || adminId,
        conversationId,
      });

      socket.emit("room-joined", { conversationId });
    } catch (error) {
      console.error("❌ Join room error:", error);
      socket.emit("support-error", { message: error.message });
    }
  });

  // ==================== LEAVE ROOM ====================
  socket.on("leave-support-room", (conversationId) => {
    socket.leave(`support:${conversationId}`);
    socket.currentSupportRoom = null;
    console.log(`👋 ${userRole} left support:${conversationId}`);
  });

  // ==================== SEND MESSAGE ====================
  socket.on("send-support-message", async (data) => {
    try {
      const { conversationId, content } = data;

      console.log(`📤 ${userRole} sending message to ${conversationId}`);

      // Verify conversation
      const conversation = await SupportConversation.findById(conversationId)
        .populate("user", "fullName email avatar")
        .populate("assignedAdmin", "fullName email avatar");

      if (!conversation) {
        return socket.emit("support-error", {
          message: "Conversation not found",
        });
      }

      // Verify quyền
      if (userRole === "user" && conversation.user._id.toString() !== userId) {
        return socket.emit("support-error", { message: "Access denied" });
      }

      const senderId = userRole === "admin" ? adminId : userId;

      // Tạo message
      const message = await SupportMessage.create({
        conversationId,
        sender: senderId,
        senderType: userRole,
        content,
        type: "text",
      });

      await message.populate("sender", "fullName email avatar");

      // Update conversation
      conversation.lastMessage = {
        content,
        sender: senderId,
        sentAt: new Date(),
      };

      // Update status nếu cần
      if (conversation.status === "waiting" && userRole === "admin") {
        conversation.status = "active";
        conversation.assignedAdmin = adminId;
      }

      // Update unread count
      if (userRole === "user") {
        conversation.unreadCount.admin += 1;
      } else {
        conversation.unreadCount.user += 1;
      }

      await conversation.save();

      const messageResponse = {
        ...message.toObject(),
        conversationId,
      };

      console.log(`✅ Message created: ${message._id}`);

      // 🔥 Emit đến TẤT CẢ trong room (kể cả người gửi)
      io.to(`support:${conversationId}`).emit(
        "new-support-message",
        messageResponse
      );

      // 🔥 Emit notification riêng
      if (userRole === "user") {
        // User gửi -> Notify admin
        io.to("admin-room").emit("support-notification", {
          type: "new_message",
          conversationId,
          message: messageResponse,
          conversation: {
            _id: conversation._id,
            user: conversation.user,
            unreadCount: conversation.unreadCount,
          },
        });
      } else {
        // Admin gửi -> Notify user
        io.to(`user:${conversation.user._id}`).emit("support-notification", {
          type: "new_message",
          conversationId,
          message: messageResponse,
        });
      }
    } catch (error) {
      console.error("❌ Send message error:", error);
      socket.emit("support-error", { message: error.message });
    }
  });

  // ==================== TYPING ====================
  socket.on("support-typing-start", ({ conversationId }) => {
    if (!conversationId) return;

    console.log(`⌨️ ${userRole} typing in ${conversationId}`);

    // Emit đến NGƯỜI KHÁC trong room (không bao gồm người gửi)
    socket.to(`support:${conversationId}`).emit("support-typing", {
      userType: userRole,
      userId: userId || adminId,
      conversationId,
    });
  });

  socket.on("support-typing-stop", ({ conversationId }) => {
    if (!conversationId) return;

    console.log(`⏹️ ${userRole} stop typing in ${conversationId}`);

    socket.to(`support:${conversationId}`).emit("support-typing-stop", {
      userType: userRole,
      userId: userId || adminId,
      conversationId,
    });
  });

  // ==================== MARK AS READ ====================
  socket.on("mark-support-read", async ({ conversationId }) => {
    try {
      const conversation = await SupportConversation.findById(conversationId);
      if (!conversation) return;

      if (userRole === "user") {
        conversation.unreadCount.user = 0;
      } else if (userRole === "admin") {
        conversation.unreadCount.admin = 0;
      }

      await conversation.save();

      console.log(`✅ ${userRole} marked ${conversationId} as read`);
    } catch (error) {
      console.error("❌ Mark as read error:", error);
    }
  });

  // ==================== DISCONNECT ====================
  socket.on("disconnect", () => {
    if (socket.currentSupportRoom) {
      socket.leave(`support:${socket.currentSupportRoom}`);
      console.log(
        `❌ ${userRole} disconnected from support:${socket.currentSupportRoom}`
      );
    }
  });
};
