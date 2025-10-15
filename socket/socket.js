// socket/socket.js
const socketIO = require("socket.io");
const Chat = require("../api/v1/models/chat.model");
const Message = require("../api/v1/models/message.model");
const SupportConversation = require("../api/v1/models/support-conversation.model");
const SupportMessage = require("../api/v1/models/support-message.model");
const User = require("../api/v1/models/user.model");

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  // Middleware xác thực socket
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth.userId;
      const userType = socket.handshake.auth.userType || "user"; // 👈 Lấy userType (user/admin)

      if (!userId) {
        return next(new Error("Authentication error"));
      }

      socket.userId = userId;
      socket.userType = userType; // 👈 Lưu userType vào socket
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `✅ ${socket.userType.toUpperCase()} connected: ${socket.userId}`
    );

    // Join user vào room riêng
    socket.join(`user:${socket.userId}`);
    if (socket.userType === "admin") {
      socket.join("admin-room"); // 👈 Admin join vào room chung để nhận thông báo
    }

    // ==================== REGULAR CHAT (2 người) ====================

    // 🔹 Join vào chat room
    socket.on("join-chat", async (chatId) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.userId,
        });

        if (chat) {
          socket.join(`chat:${chatId}`);
          console.log(`User ${socket.userId} joined chat ${chatId}`);
        }
      } catch (error) {
        console.error("Join chat error:", error);
      }
    });

    // 🔹 Rời khỏi chat room
    socket.on("leave-chat", (chatId) => {
      socket.leave(`chat:${chatId}`);
      console.log(`User ${socket.userId} left chat ${chatId}`);
    });

    // 🔹 Gửi tin nhắn realtime
    socket.on("send-message", async (data) => {
      try {
        const { chatId, content, type = "text", replyTo } = data;

        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.userId,
        });

        if (!chat) {
          return socket.emit("error", { message: "Access denied" });
        }

        const message = await Message.create({
          chatId,
          sender: socket.userId,
          content,
          type,
          replyTo,
          seenBy: [socket.userId],
        });

        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: message._id,
          lastMessageAt: new Date(),
        });

        const otherParticipants = chat.participants.filter(
          (p) => p.toString() !== socket.userId.toString()
        );

        for (const participantId of otherParticipants) {
          await Chat.updateOne(
            { _id: chatId },
            { $inc: { "unreadCount.$[elem].count": 1 } },
            { arrayFilters: [{ "elem.userId": participantId }] }
          );
        }

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "userName customName avatar")
          .populate({
            path: "replyTo",
            populate: {
              path: "sender",
              select: "userName customName avatar",
            },
          });

        io.to(`chat:${chatId}`).emit("new-message", populatedMessage);

        otherParticipants.forEach((participantId) => {
          io.to(`user:${participantId}`).emit("chat-updated", {
            chatId,
            lastMessage: populatedMessage,
          });
        });
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // 🔹 Typing indicator
    socket.on("typing-start", ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit("user-typing", {
        userId: socket.userId,
        chatId,
      });
    });

    socket.on("typing-stop", ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit("user-stop-typing", {
        userId: socket.userId,
        chatId,
      });
    });

    // 🔹 Đánh dấu đã đọc
    socket.on("mark-as-read", async ({ chatId }) => {
      try {
        await Message.updateMany(
          {
            chatId,
            sender: { $ne: socket.userId },
            seenBy: { $ne: socket.userId },
          },
          { $addToSet: { seenBy: socket.userId } }
        );

        await Chat.updateOne(
          { _id: chatId },
          { $set: { "unreadCount.$[elem].count": 0 } },
          { arrayFilters: [{ "elem.userId": socket.userId }] }
        );

        socket.to(`chat:${chatId}`).emit("messages-read", {
          userId: socket.userId,
          chatId,
        });
      } catch (error) {
        console.error("Mark as read error:", error);
      }
    });

    // 🔹 Xóa tin nhắn
    socket.on("delete-message", async ({ messageId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          {
            $addToSet: { "deleted.by": socket.userId },
            "deleted.at": new Date(),
          },
          { new: true }
        );

        if (message) {
          io.to(`chat:${message.chatId}`).emit("message-deleted", {
            messageId,
            userId: socket.userId,
          });
        }
      } catch (error) {
        console.error("Delete message error:", error);
      }
    });

    // 🔹 React to message
    socket.on("react-message", async ({ messageId, reactionType }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        message.reactions = message.reactions.filter(
          (r) => r.userId.toString() !== socket.userId.toString()
        );

        if (reactionType) {
          message.reactions.push({
            userId: socket.userId,
            type: reactionType,
          });
        }

        await message.save();

        io.to(`chat:${message.chatId}`).emit("message-reacted", {
          messageId,
          reactions: message.reactions,
        });
      } catch (error) {
        console.error("React message error:", error);
      }
    });

    // 🔹 Edit message
    socket.on("edit-message", async ({ messageId, content }) => {
      try {
        const message = await Message.findOne({
          _id: messageId,
          sender: socket.userId,
        });

        if (!message) return;

        message.content = content;
        message.edited = true;
        await message.save();

        const populatedMessage = await Message.findById(message._id).populate(
          "sender",
          "userName customName avatar"
        );

        io.to(`chat:${message.chatId}`).emit(
          "message-edited",
          populatedMessage
        );
      } catch (error) {
        console.error("Edit message error:", error);
      }
    });

    // ==================== SUPPORT CHAT (User <-> Admin) ====================

    // 🔹 Join vào support chat room
    socket.on("join-support-chat", async (conversationId) => {
      try {
        const conversation = await SupportConversation.findById(conversationId);

        if (!conversation) return;

        // Kiểm tra quyền truy cập
        const hasAccess =
          socket.userType === "admin" ||
          conversation.user.toString() === socket.userId.toString();

        if (hasAccess) {
          socket.join(`support:${conversationId}`);
          console.log(
            `${socket.userType.toUpperCase()} ${
              socket.userId
            } joined support chat ${conversationId}`
          );
        }
      } catch (error) {
        console.error("Join support chat error:", error);
      }
    });

    // 🔹 Rời khỏi support chat room
    socket.on("leave-support-chat", (conversationId) => {
      socket.leave(`support:${conversationId}`);
      console.log(
        `${socket.userType.toUpperCase()} ${
          socket.userId
        } left support chat ${conversationId}`
      );
    });

    // 🔹 Gửi tin nhắn support
    socket.on("send-support-message", async (data) => {
      try {
        const { conversationId, content, type = "text" } = data;

        const conversation = await SupportConversation.findById(conversationId);
        if (!conversation) {
          return socket.emit("error", { message: "Conversation not found" });
        }

        // Kiểm tra quyền gửi tin nhắn
        const canSend =
          socket.userType === "admin" ||
          conversation.user.toString() === socket.userId.toString();

        if (!canSend) {
          return socket.emit("error", { message: "Access denied" });
        }

        // Tạo tin nhắn
        const message = await SupportMessage.create({
          conversationId,
          sender: socket.userId,
          senderType: socket.userType,
          content,
          type,
          seenBy: [socket.userId],
          isSystemMessage: false,
        });

        // Cập nhật conversation
        conversation.lastMessage = {
          content,
          sender: socket.userId,
          sentAt: new Date(),
        };

        // Tăng unreadCount cho người còn lại
        if (socket.userType === "user") {
          conversation.unreadCount.admin += 1;
        } else {
          conversation.unreadCount.user += 1;
        }

        await conversation.save();

        // Populate message
        const populatedMessage = await SupportMessage.findById(
          message._id
        ).populate("sender", "fullName avatar");

        // Gửi tin nhắn đến tất cả người trong room
        io.to(`support:${conversationId}`).emit(
          "new-support-message",
          populatedMessage
        );

        // Thông báo cho admin nếu user gửi
        if (socket.userType === "user") {
          io.to("admin-room").emit("support-conversation-updated", {
            conversationId,
            lastMessage: populatedMessage,
            unreadCount: conversation.unreadCount.admin,
          });
        }

        // Thông báo cho user nếu admin gửi
        if (socket.userType === "admin") {
          io.to(`user:${conversation.user}`).emit("support-message-received", {
            conversationId,
            message: populatedMessage,
          });
        }
      } catch (error) {
        console.error("Send support message error:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // 🔹 Support typing indicator
    socket.on("support-typing-start", ({ conversationId }) => {
      socket.to(`support:${conversationId}`).emit("support-user-typing", {
        userId: socket.userId,
        userType: socket.userType,
        conversationId,
      });
    });

    socket.on("support-typing-stop", ({ conversationId }) => {
      socket.to(`support:${conversationId}`).emit("support-user-stop-typing", {
        userId: socket.userId,
        userType: socket.userType,
        conversationId,
      });
    });

    // 🔹 Đánh dấu support messages đã đọc
    socket.on("mark-support-as-read", async ({ conversationId }) => {
      try {
        await SupportMessage.updateMany(
          {
            conversationId,
            sender: { $ne: socket.userId },
            seenBy: { $ne: socket.userId },
          },
          { $addToSet: { seenBy: socket.userId } }
        );

        const conversation = await SupportConversation.findById(conversationId);
        if (conversation) {
          if (socket.userType === "user") {
            conversation.unreadCount.user = 0;
          } else {
            conversation.unreadCount.admin = 0;
          }
          await conversation.save();
        }

        socket.to(`support:${conversationId}`).emit("support-messages-read", {
          userId: socket.userId,
          userType: socket.userType,
          conversationId,
        });
      } catch (error) {
        console.error("Mark support as read error:", error);
      }
    });

    // ==================== DISCONNECT ====================

    socket.on("disconnect", () => {
      console.log(
        `❌ ${socket.userType.toUpperCase()} disconnected: ${socket.userId}`
      );
    });
  });

  return io;
}

module.exports = initializeSocket;
