// ========================================
// socket/handlers/message.handler.js
// ========================================
const Message = require("../../api/v1/models/message.model");
const Conversation = require("../../api/v1/models/conversation.model");

module.exports = (io, socket) => {
  // Send message
  socket.on("send-message", async (data) => {
    try {
      const { conversationId, content, type = "text", replyTo } = data;

      // Kiểm tra quyền
      const conversation = await Conversation.findOne({
        _id: conversationId,
        "participants.userId": socket.userId,
      });

      if (!conversation) {
        return socket.emit("error", { message: "Access denied" });
      }

      // Check if user left group
      const userParticipant = conversation.participants.find(
        (p) => p.userId.toString() === socket.userId.toString()
      );

      if (userParticipant?.leftAt) {
        return socket.emit("error", {
          message: "You have left this conversation",
        });
      }

      if (!content || !content.trim()) {
        return socket.emit("error", { message: "Content is required" });
      }

      // Tạo message
      const message = await Message.create({
        conversationId,
        senderId: socket.userId,
        content: content.trim(),
        type,
        replyTo: replyTo || null,
        seenBy: [{ userId: socket.userId, seenAt: new Date() }],
      });

      // Cập nhật conversation
      const unreadCounts = conversation.unreadCounts || new Map();

      // Tăng unread count cho người khác
      conversation.participants.forEach((p) => {
        const participantId = p.userId.toString();
        if (participantId !== socket.userId.toString() && !p.leftAt) {
          const currentCount = unreadCounts.get(participantId) || 0;
          unreadCounts.set(participantId, currentCount + 1);
        }
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
          messageId: message._id,
          content: message.content,
          senderId: socket.userId,
          type: message.type,
          createdAt: message.createdAt,
        },
        lastMessageAt: new Date(),
        unreadCounts: unreadCounts,
        seenBy: [socket.userId],
      });

      // Populate message
      const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "userName customName avatar")
        .populate({
          path: "replyTo",
          populate: {
            path: "senderId",
            select: "userName customName avatar",
          },
        })
        .lean();

      // Emit to conversation room
      io.to(`conversation:${conversationId}`).emit(
        "new-message",
        populatedMessage
      );

      // Notify other participants about conversation update
      conversation.participants.forEach((p) => {
        if (p.userId.toString() !== socket.userId.toString() && !p.leftAt) {
          io.to(`user:${p.userId}`).emit("conversation-updated", {
            conversationId,
            lastMessage: populatedMessage,
            unreadCount: unreadCounts.get(p.userId.toString()) || 0,
          });
        }
      });
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Delete message
  socket.on("delete-message", async ({ messageId }) => {
    try {
      const message = await Message.findByIdAndUpdate(
        messageId,
        {
          $addToSet: { deletedFor: socket.userId },
        },
        { new: true }
      );

      if (message) {
        io.to(`conversation:${message.conversationId}`).emit(
          "message-deleted",
          {
            messageId,
            userId: socket.userId,
          }
        );
      }
    } catch (error) {
      console.error("Delete message error:", error);
    }
  });

  // React to message
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
          createdAt: new Date(),
        });
      }

      await message.save();

      io.to(`conversation:${message.conversationId}`).emit("message-reacted", {
        messageId,
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("React message error:", error);
    }
  });

  // Edit message
  socket.on("edit-message", async ({ messageId, content }) => {
    try {
      const message = await Message.findOne({
        _id: messageId,
        senderId: socket.userId,
      });

      if (!message) return;

      message.content = content.trim();
      message.edited = true;
      message.editedAt = new Date();
      await message.save();

      const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "userName customName avatar")
        .lean();

      io.to(`conversation:${message.conversationId}`).emit(
        "message-edited",
        populatedMessage
      );
    } catch (error) {
      console.error("Edit message error:", error);
    }
  });

  // Mark messages as read
  socket.on("mark-as-read", async ({ conversationId }) => {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        "participants.userId": socket.userId,
      });

      if (!conversation) return;

      // Update messages
      await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: socket.userId },
          "seenBy.userId": { $ne: socket.userId },
        },
        {
          $push: {
            seenBy: {
              userId: socket.userId,
              seenAt: new Date(),
            },
          },
        }
      );

      // Reset unread count
      const unreadCounts = conversation.unreadCounts || new Map();
      unreadCounts.set(socket.userId.toString(), 0);

      await Conversation.findByIdAndUpdate(conversationId, {
        unreadCounts: unreadCounts,
        $addToSet: { seenBy: socket.userId },
      });

      socket.to(`conversation:${conversationId}`).emit("messages-read", {
        userId: socket.userId,
        conversationId,
      });
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  });
};
