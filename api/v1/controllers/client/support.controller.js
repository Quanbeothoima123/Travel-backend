// controllers/client/support.controller.js - SIMPLIFIED
const SupportConversation = require("../../models/support-conversation.model");
const SupportMessage = require("../../models/support-message.model");
const User = require("../../models/user.model");

// [GET] Lấy hoặc tạo conversation (1 user = 1 conversation)
module.exports.getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    // Tìm conversation hiện có
    let conversation = await SupportConversation.findOne({
      user: userId,
    })
      .populate("user", "fullName email avatar")
      .populate("assignedAdmin", "fullName email avatar")
      .sort({ createdAt: -1 });

    // Nếu chưa có, tạo mới
    if (!conversation) {
      conversation = await SupportConversation.create({
        user: userId,
        issueDescription: "Hỗ trợ chung",
        status: "waiting",
        unreadCount: { user: 0, admin: 0 },
      });

      await conversation.populate("user", "fullName email avatar");

      // Notify admin
      const io = req.app.get("io");
      if (io) {
        io.to("admin-room").emit("new-support-conversation", {
          conversation,
        });
      }
    }

    // Reset unread count
    conversation.unreadCount.user = 0;
    await conversation.save();

    res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("❌ Get or create conversation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// [GET] Lấy lịch sử tin nhắn
module.exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Verify quyền
    const conversation = await SupportConversation.findOne({
      _id: conversationId,
      user: userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cuộc trò chuyện",
      });
    }

    // Lấy messages
    const messages = await SupportMessage.find({ conversationId })
      .populate("sender", "fullName avatar")
      .sort({ createdAt: 1 });

    // Mark as read
    conversation.unreadCount.user = 0;
    await conversation.save();

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("❌ Get messages error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
