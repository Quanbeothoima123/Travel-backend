// ========================================
// socket/handlers/message.handler.js (OPTIMIZED)
// ========================================
const Message = require("../../api/v1/models/message.model");
const Conversation = require("../../api/v1/models/conversation.model");

// ✅ Helper: Cập nhật unreadCount một cách tập trung
async function updateUnreadCounts(conversation, senderId, io) {
  const unreadCounts = {};

  // Tất cả participants (trừ sender và người đã rời) tăng count
  conversation.participants.forEach((p) => {
    const participantId = p.userId.toString();
    if (!p.leftAt) {
      unreadCounts[participantId] =
        participantId === senderId.toString()
          ? 0
          : (conversation.unreadCounts?.get?.(participantId) ||
              conversation.unreadCounts?.[participantId] ||
              0) + 1;
    }
  });

  return unreadCounts;
}

// ✅ Helper: Emit conversation update cho tất cả participants
function emitConversationUpdate(
  io,
  conversation,
  populatedMessage,
  unreadCounts
) {
  conversation.participants.forEach((p) => {
    if (!p.leftAt) {
      const participantId = p.userId.toString();
      io.to(`user:${participantId}`).emit("conversation-updated", {
        conversationId: conversation._id.toString(),
        lastMessage: {
          _id: populatedMessage._id,
          content: populatedMessage.content,
          type: populatedMessage.type,
          createdAt: populatedMessage.createdAt,
          senderId: {
            _id: populatedMessage.senderId._id,
            customName: populatedMessage.senderId.customName,
            userName: populatedMessage.senderId.userName,
            avatar: populatedMessage.senderId.avatar,
          },
        },
        unreadCount: unreadCounts[participantId] || 0,
        lastMessageAt: populatedMessage.createdAt,
      });
    }
  });
}

module.exports = (io, socket) => {
  // ========================================
  // 📤 SEND MESSAGE
  // ========================================
  socket.on("send-message", async (data) => {
    try {
      const { conversationId, content, type = "text", replyTo } = data;

      // Validate
      const conversation = await Conversation.findOne({
        _id: conversationId,
        "participants.userId": socket.userId,
      });

      if (!conversation) {
        return socket.emit("error", { message: "Access denied" });
      }

      const userParticipant = conversation.participants.find(
        (p) => p.userId.toString() === socket.userId.toString()
      );

      if (userParticipant?.leftAt) {
        return socket.emit("error", {
          message: "You have left this conversation",
        });
      }

      if (!content?.trim()) {
        return socket.emit("error", { message: "Content is required" });
      }

      // Create message
      const message = await Message.create({
        conversationId,
        senderId: socket.userId,
        content: content.trim(),
        type,
        replyTo: replyTo || null,
        seenBy: [{ userId: socket.userId, seenAt: new Date() }],
      });

      // Update unreadCounts
      const unreadCounts = await updateUnreadCounts(
        conversation,
        socket.userId,
        io
      );

      // Update conversation
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
          populate: { path: "senderId", select: "userName customName avatar" },
        })
        .lean();

      // Emit tin nhắn mới vào conversation room
      io.to(`conversation:${conversationId}`).emit(
        "new-message",
        populatedMessage
      );

      // Emit conversation update cho sidebar
      emitConversationUpdate(io, conversation, populatedMessage, unreadCounts);

      console.log(`✅ Message sent in conversation ${conversationId}`);
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // ========================================
  // 👁️ MARK AS READ
  // ========================================
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
          $push: { seenBy: { userId: socket.userId, seenAt: new Date() } },
        }
      );

      // Reset unread count
      const unreadCounts =
        conversation.unreadCounts instanceof Map
          ? Object.fromEntries(conversation.unreadCounts)
          : { ...conversation.unreadCounts };

      unreadCounts[socket.userId.toString()] = 0;

      await Conversation.findByIdAndUpdate(conversationId, {
        unreadCounts: unreadCounts,
        $addToSet: { seenBy: socket.userId },
      });

      // Emit cho chính user này
      io.to(`user:${socket.userId}`).emit("conversation-updated", {
        conversationId,
        unreadCount: 0,
      });

      // Emit cho người khác biết đã xem
      socket.to(`conversation:${conversationId}`).emit("messages-read", {
        userId: socket.userId,
        conversationId,
      });
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  });

  // ========================================
  // 🗑️ DELETE MESSAGE
  // ========================================
  socket.on("delete-message", async ({ messageId }) => {
    try {
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { deletedFor: socket.userId } },
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

        // Nếu xóa lastMessage thì cập nhật sidebar
        const conversation = await Conversation.findById(
          message.conversationId
        );
        if (conversation?.lastMessage?.messageId?.toString() === messageId) {
          // Tìm message trước đó
          const previousMessage = await Message.findOne({
            conversationId: message.conversationId,
            _id: { $ne: messageId },
            deletedFor: { $ne: socket.userId },
          })
            .sort({ createdAt: -1 })
            .populate("senderId", "userName customName avatar")
            .lean();

          if (previousMessage) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
              lastMessage: {
                messageId: previousMessage._id,
                content: previousMessage.content,
                senderId: previousMessage.senderId._id,
                type: previousMessage.type,
                createdAt: previousMessage.createdAt,
              },
            });

            // Emit update sidebar
            io.to(`user:${socket.userId}`).emit("conversation-updated", {
              conversationId: message.conversationId,
              lastMessage: {
                _id: previousMessage._id,
                content: previousMessage.content,
                type: previousMessage.type,
                createdAt: previousMessage.createdAt,
                senderId: previousMessage.senderId,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Delete message error:", error);
    }
  });

  // ========================================
  // 📝 EDIT MESSAGE
  // ========================================
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

      // Update sidebar nếu là lastMessage
      const conversation = await Conversation.findById(message.conversationId);
      if (conversation?.lastMessage?.messageId?.toString() === messageId) {
        await Conversation.findByIdAndUpdate(message.conversationId, {
          "lastMessage.content": message.content,
        });

        conversation.participants.forEach((p) => {
          if (!p.leftAt) {
            io.to(`user:${p.userId}`).emit("conversation-updated", {
              conversationId: message.conversationId,
              lastMessage: {
                _id: populatedMessage._id,
                content: populatedMessage.content,
                type: populatedMessage.type,
                createdAt: populatedMessage.createdAt,
                senderId: populatedMessage.senderId,
              },
            });
          }
        });
      }
    } catch (error) {
      console.error("Edit message error:", error);
    }
  });

  // ========================================
  // 👍 REACT TO MESSAGE
  // ========================================
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
};
