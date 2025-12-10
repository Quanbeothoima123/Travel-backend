// controllers/message.controller.js (FINAL VERSION - Pure conversationId)
const Message = require("../../models/message.model");
const Conversation = require("../../models/conversation.model");

// Route: GET /api/v1/message/:conversationId
// ✅ FIX: Không tự động mark as read khi getMessages
module.exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.userId;

    // Kiểm tra quyền truy cập
    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập đoạn chat này!",
      });
    }

    // Check if user left
    const userParticipant = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (userParticipant?.leftAt) {
      return res.status(403).json({
        success: false,
        message: "Bạn đã rời khỏi đoạn chat này rồi!",
      });
    }

    // ✅ Chỉ lấy tin nhắn, KHÔNG mark as read
    const messages = await Message.find({
      conversationId,
      deletedFor: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("senderId", "userName customName avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "senderId",
          select: "userName customName avatar",
        },
      })
      .lean();

    // ✅ Trả về unreadCount hiện tại (không reset)
    const unreadCount =
      conversation.unreadCounts instanceof Map
        ? conversation.unreadCounts.get(userId.toString()) || 0
        : conversation.unreadCounts?.[userId.toString()] || 0;

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        hasMore: messages.length === parseInt(limit),
        page: parseInt(page),
        unreadCount, // ✅ Thêm field này để frontend biết
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Các handler khác giữ nguyên...
module.exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = "text", replyTo } = req.body;
    const userId = req.user.userId;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Bạn không được phép gửi tin nhắn vào đoạn chat này",
      });
    }

    const userParticipant = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (userParticipant?.leftAt) {
      return res.status(403).json({
        success: false,
        message: "Bạn đã rời khỏi cuộc thảo luận này rồi",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung tin nhắn",
      });
    }

    const message = await Message.create({
      conversationId,
      senderId: userId,
      content: content.trim(),
      type,
      replyTo: replyTo || null,
      seenBy: [{ userId: userId, seenAt: new Date() }],
    });

    const unreadCounts =
      conversation.unreadCounts instanceof Map
        ? Object.fromEntries(conversation.unreadCounts)
        : { ...conversation.unreadCounts };

    conversation.participants.forEach((p) => {
      const participantId = p.userId.toString();
      if (participantId !== userId.toString() && !p.leftAt) {
        const currentCount = unreadCounts[participantId] || 0;
        unreadCounts[participantId] = currentCount + 1;
      }
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        messageId: message._id,
        content: message.content,
        senderId: userId,
        type: message.type,
        createdAt: message.createdAt,
      },
      lastMessageAt: new Date(),
      unreadCounts: unreadCounts,
      seenBy: [userId],
    });

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

    res.json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: DELETE /api/v1/message/:messageId
module.exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Kiểm tra quyền
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Thêm vào deletedFor
    await Message.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: userId },
    });

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: PATCH /api/v1/message/:messageId/react
module.exports.reactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reactionType } = req.body;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Kiểm tra quyền
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Xóa reaction cũ
    message.reactions = message.reactions.filter(
      (r) => r.userId.toString() !== userId.toString()
    );

    // Thêm reaction mới nếu có
    if (reactionType) {
      message.reactions.push({
        userId,
        type: reactionType,
        createdAt: new Date(),
      });
    }

    await message.save();

    res.json({
      success: true,
      data: { reactions: message.reactions },
    });
  } catch (error) {
    console.error("React message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: PATCH /api/v1/message/:messageId
module.exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: "Content is required",
      });
    }

    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found or access denied",
      });
    }

    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

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

    res.json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: POST /api/v1/message/:conversationId/mark-read
module.exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Kiểm tra quyền
    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Cập nhật seenBy cho tất cả tin nhắn chưa seen
    await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: userId },
        "seenBy.userId": { $ne: userId },
      },
      {
        $push: {
          seenBy: {
            userId: userId,
            seenAt: new Date(),
          },
        },
      }
    );

    // Reset unread count
    const unreadCounts = conversation.unreadCounts || {};
    unreadCounts[userId.toString()] = 0;

    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCounts: unreadCounts,
      $addToSet: { seenBy: userId },
    });

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
