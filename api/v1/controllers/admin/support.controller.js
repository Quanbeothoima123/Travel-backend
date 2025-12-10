// controllers/admin/support.controller.js
const SupportConversation = require("../../models/support-conversation.model");
const SupportMessage = require("../../models/support-message.model");
const User = require("../../models/user.model");

// [GET] Lấy danh sách tất cả cuộc trò chuyện
module.exports.getAllConversations = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);

      filter.$or = [
        { user: { $in: userIds } },
        { issueDescription: { $regex: search, $options: "i" } },
      ];
    }

    const conversations = await SupportConversation.find(filter)
      .populate("user", "fullName email avatar")
      .populate("assignedAdmin", "fullName email avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SupportConversation.countDocuments(filter);

    const statusCounts = await SupportConversation.aggregate([
      {
        $group: { _id: "$status", count: { $sum: 1 } },
      },
    ]);

    const counts = { all: total, waiting: 0, active: 0, closed: 0 };
    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
    });

    res.json({
      success: true,
      conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      counts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// [GET] Lấy chi tiết cuộc trò chuyện
module.exports.getConversationDetailAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const adminId = req.adminId;

    const conversation = await SupportConversation.findById(conversationId)
      .populate("user", "fullName email avatar phone")
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
      { conversationId, seenBy: { $ne: adminId } },
      { $addToSet: { seenBy: adminId } }
    );

    conversation.unreadCount.admin = 0;
    await conversation.save();

    res.json({ success: true, conversation, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
