// controllers/message.controller.js
const Message = require("../../models/message.model");
const Chat = require("../../models/chat.model");
const User = require("../../models/user.model");

// Route: GET /api/v1/message/get-messages/:chatId
module.exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.userId;

    // Kiểm tra quyền truy cập
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Lấy tin nhắn
    const messages = await Message.find({
      chatId,
      "deleted.by": { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("sender", "userName customName avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "userName customName avatar",
        },
      });

    // Đánh dấu đã đọc
    await Message.updateMany(
      {
        chatId,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
      },
      { $addToSet: { seenBy: userId } }
    );

    // Reset unread count
    await Chat.updateOne(
      { _id: chatId },
      { $set: { "unreadCount.$[elem].count": 0 } },
      { arrayFilters: [{ "elem.userId": userId }] }
    );

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        hasMore: messages.length === parseInt(limit),
        page: parseInt(page),
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: POST /api/v1/message/send-massage/:chatId
module.exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, type = "text", replyTo } = req.body;
    const userId = req.user.userId;

    // Kiểm tra quyền
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: "Content is required",
      });
    }

    // Tạo message
    const message = await Message.create({
      chatId,
      sender: userId,
      content: content.trim(),
      type,
      replyTo: replyTo || null,
      seenBy: [userId],
    });

    // Cập nhật chat
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
    });

    // Tăng unread count cho người khác
    const otherParticipants = chat.participants.filter(
      (p) => p.toString() !== userId.toString()
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

    res.json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: DELETE /api/v1/message/delete/:messageId
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
    const chat = await Chat.findOne({
      _id: message.chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Thêm vào deleted.by
    await Message.findByIdAndUpdate(messageId, {
      $addToSet: { "deleted.by": userId },
      "deleted.at": new Date(),
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

// Route: PATCH /api/v1/message/react/:messageId
module.exports.reactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reactionType } = req.body; // 'like', 'love', 'haha', 'wow', 'sad', 'angry', null để xóa
    const userId = req.user.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Kiểm tra quyền
    const chat = await Chat.findOne({
      _id: message.chatId,
      participants: userId,
    });

    if (!chat) {
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

// Route: PATCH /api/v1/message//edit/:messageId
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
      sender: userId, // Chỉ người gửi mới được sửa
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found or access denied",
      });
    }

    message.content = content.trim();
    message.edited = true;
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "userName customName avatar")
      .populate("replyTo");

    res.json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: POST /api/v1/message/mark-read/:chatId
module.exports.markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Kiểm tra quyền
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Cập nhật seenBy cho tất cả tin nhắn
    await Message.updateMany(
      {
        chatId,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
      },
      { $addToSet: { seenBy: userId } }
    );

    // Reset unread count
    await Chat.updateOne(
      { _id: chatId },
      { $set: { "unreadCount.$[elem].count": 0 } },
      { arrayFilters: [{ "elem.userId": userId }] }
    );

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
