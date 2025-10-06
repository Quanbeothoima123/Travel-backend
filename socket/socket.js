// socket/socket.js
const socketIO = require("socket.io");
const Chat = require("../api/v1/models/chat.model");
const Message = require("../api/v1/models/message.model");

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

        // Kiểm tra quyền
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.userId,
        });

        if (!chat) {
          return socket.emit("error", { message: "Access denied" });
        }

        // Tạo message
        const message = await Message.create({
          chatId,
          sender: socket.userId,
          content,
          type,
          replyTo,
          seenBy: [socket.userId],
        });

        // Cập nhật chat
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: message._id,
          lastMessageAt: new Date(),
        });

        // Tăng unread count cho người khác
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

        // Populate message
        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "userName customName avatar")
          .populate({
            path: "replyTo",
            populate: {
              path: "sender",
              select: "userName customName avatar",
            },
          });

        // Gửi tin nhắn đến tất cả người trong chat
        io.to(`chat:${chatId}`).emit("new-message", populatedMessage);

        // Gửi notification đến người khác để cập nhật sidebar
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

        // Xóa reaction cũ
        message.reactions = message.reactions.filter(
          (r) => r.userId.toString() !== socket.userId.toString()
        );

        // Thêm reaction mới
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

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

module.exports = initializeSocket;
