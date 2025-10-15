// controllers/supportClient.controller.js
const SupportConversation = require("../../models/support-conversation.model");
const SupportMessage = require("../../models/support-message.model");
const User = require("../../models/user.model");

// [POST] Kiểm tra trạng thái đăng nhập
module.exports.checkAuthStatus = async (req, res) => {
  try {
    if (!req.user.userId) {
      return res.json({ success: false, isAuthenticated: false });
    }
    const userId = req.user.userId;

    const user = await User.findById(userId).select("fullName email avatar");

    res.json({
      success: true,
      isAuthenticated: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// [POST] Tạo cuộc trò chuyện mới
module.exports.createConversation = async (req, res) => {
  try {
    const { issueDescription, phoneNumber } = req.body;
    const userId = req.user.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập" });
    }

    const conversation = await SupportConversation.create({
      user: userId,
      issueDescription,
      phoneNumber: phoneNumber || "",
      status: "waiting",
      unreadCount: { user: 0, admin: 1 },
    });

    await SupportMessage.create({
      conversationId: conversation._id,
      sender: userId,
      senderType: "user",
      content: issueDescription,
      type: "text",
      isSystemMessage: false,
      seenBy: [userId],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("new-support-conversation", {
        conversationId: conversation._id,
        user: await User.findById(userId).select("fullName email avatar"),
        issueDescription,
        createdAt: conversation.createdAt,
      });
    }

    res.json({
      success: true,
      conversationId: conversation._id,
      message: "Cuộc trò chuyện đã được tạo thành công",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// [GET] Lấy lịch sử cuộc trò chuyện
module.exports.getConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      user: userId,
    })
      .populate("user", "fullName email avatar")
      .populate("assignedAdmin", "fullName email avatar");

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    const messages = await SupportMessage.find({ conversationId })
      .populate("sender", "fullName avatar")
      .sort({ createdAt: 1 });

    await SupportMessage.updateMany(
      { conversationId, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } }
    );

    conversation.unreadCount.user = 0;
    await conversation.save();

    res.json({
      success: true,
      conversation,
      messages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// [POST] Đóng cuộc trò chuyện
module.exports.closeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    conversation.status = "closed";
    conversation.closedAt = new Date();
    await conversation.save();

    await SupportMessage.create({
      conversationId,
      sender: userId,
      senderType: "system",
      content: "Người dùng đã đóng cuộc trò chuyện",
      type: "system",
      isSystemMessage: true,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`support:${conversationId}`).emit("conversation-closed", {
        conversationId,
        closedBy: "user",
      });
    }

    res.json({ success: true, message: "Cuộc trò chuyện đã đóng" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// [POST] Gửi feedback
module.exports.submitFeedback = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { isResolved, rating, comment } = req.body;
    const userId = req.user.userId;

    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    conversation.feedback = {
      isResolved,
      rating: isResolved ? rating : null,
      comment: !isResolved ? comment : "",
      submittedAt: new Date(),
    };

    await conversation.save();

    res.json({ success: true, message: "Cảm ơn phản hồi của bạn!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
