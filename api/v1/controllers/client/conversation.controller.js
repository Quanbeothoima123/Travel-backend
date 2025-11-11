// controllers/conversation.controller.js (FINAL VERSION)
const Conversation = require("../../models/conversation.model");
const Message = require("../../models/message.model");
const User = require("../../models/user.model");
const Nickname = require("../../models/nickname.model");

// Route: GET /api/v1/conversation
module.exports.getConversationList = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Tìm conversations mà user tham gia, chưa xóa và chưa rời
    const conversations = await Conversation.find({
      "participants.userId": userId,
      deletedFor: { $ne: userId },
      participants: {
        $elemMatch: {
          userId: userId,
          $or: [{ leftAt: { $exists: false } }, { leftAt: null }],
        },
      },
    })
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean();

    // Format data cho frontend
    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Fix: unreadCounts là object khi dùng .lean(), không phải Map
        const unreadCount = conv.unreadCounts?.[userId.toString()] || 0;

        // Xử lý theo type
        if (conv.type === "private") {
          // PRIVATE CHAT
          const otherParticipant = conv.participants.find(
            (p) => p.userId.toString() !== userId.toString()
          );

          if (!otherParticipant) return null;

          const otherUser = await User.findById(otherParticipant.userId)
            .select("_id userName customName avatar")
            .lean();

          if (!otherUser) return null;

          // Lấy nickname nếu có
          const nicknameDoc = await Nickname.findOne({
            setBy: userId,
            forUser: otherUser._id,
          }).lean();

          return {
            conversationId: conv._id,
            type: conv.type,
            name:
              nicknameDoc?.nickname ||
              otherUser.customName ||
              otherUser.userName,
            avatar: otherUser.avatar,
            lastMessage: conv.lastMessage
              ? {
                  content: conv.lastMessage.content,
                  type: conv.lastMessage.type,
                  createdAt: conv.lastMessage.createdAt,
                  isMe:
                    conv.lastMessage.senderId?.toString() === userId.toString(),
                }
              : null,
            unreadCount,
            updatedAt: conv.lastMessageAt || conv.updatedAt,
          };
        } else {
          // GROUP CHAT
          const activeMembersCount = conv.participants.filter(
            (p) => !p.leftAt
          ).length;

          return {
            conversationId: conv._id,
            type: conv.type,
            name: conv.groupInfo?.name || "Unnamed Group",
            avatar: conv.groupInfo?.avatar,
            membersCount: activeMembersCount,
            lastMessage: conv.lastMessage
              ? {
                  content: conv.lastMessage.content,
                  type: conv.lastMessage.type,
                  createdAt: conv.lastMessage.createdAt,
                  isMe:
                    conv.lastMessage.senderId?.toString() === userId.toString(),
                }
              : null,
            unreadCount,
            updatedAt: conv.lastMessageAt || conv.updatedAt,
          };
        }
      })
    );

    // Lọc null values
    const validConversations = formattedConversations.filter(Boolean);

    res.json({ success: true, data: validConversations });
  } catch (error) {
    console.error("Get conversation list error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: POST /api/v1/conversation/create-or-get
module.exports.createOrGetConversation = async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.user.userId;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        error: "otherUserId is required",
      });
    }

    // Kiểm tra người dùng có tồn tại không
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Tìm conversation hiện có
    let conversation = await Conversation.findOne({
      type: "private",
      "participants.userId": { $all: [userId, otherUserId] },
      $expr: { $eq: [{ $size: "$participants" }, 2] },
    });

    // Nếu chưa có, tạo mới
    if (!conversation) {
      // Tạo unreadCounts object
      const unreadCounts = {};
      unreadCounts[userId.toString()] = 0;
      unreadCounts[otherUserId.toString()] = 0;

      conversation = await Conversation.create({
        type: "private",
        participants: [
          { userId: userId, joinedAt: new Date() },
          { userId: otherUserId, joinedAt: new Date() },
        ],
        lastMessageAt: new Date(),
        unreadCounts: unreadCounts,
      });
    }

    // Lấy nickname nếu có
    const nicknameDoc = await Nickname.findOne({
      setBy: userId,
      forUser: otherUserId,
    }).lean();

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        type: conversation.type,
        otherUser: {
          _id: otherUser._id,
          name:
            nicknameDoc?.nickname || otherUser.customName || otherUser.userName,
          avatar: otherUser.avatar,
        },
      },
    });
  } catch (error) {
    console.error("Create or get conversation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: GET /api/v1/conversation/:conversationId
module.exports.getConversationDetail = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Kiểm tra quyền truy cập
    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.userId": userId,
    }).lean();

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Check if user left
    const userParticipant = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (userParticipant?.leftAt) {
      return res.status(403).json({
        success: false,
        error: "You have left this conversation",
      });
    }

    // Xử lý theo type
    if (conversation.type === "private") {
      // PRIVATE CHAT
      const otherParticipant = conversation.participants.find(
        (p) => p.userId.toString() !== userId.toString()
      );

      if (!otherParticipant) {
        return res.status(404).json({
          success: false,
          error: "Other user not found",
        });
      }

      const otherUser = await User.findById(otherParticipant.userId)
        .select("_id userName customName avatar")
        .lean();

      if (!otherUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Lấy nickname nếu có
      const nicknameDoc = await Nickname.findOne({
        setBy: userId,
        forUser: otherUser._id,
      }).lean();

      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          type: conversation.type,
          otherUser: {
            _id: otherUser._id,
            name:
              nicknameDoc?.nickname ||
              otherUser.customName ||
              otherUser.userName,
            avatar: otherUser.avatar,
          },
        },
      });
    } else {
      // GROUP CHAT
      const activeMembers = conversation.participants.filter((p) => !p.leftAt);

      // Populate member info
      const memberIds = activeMembers.map((p) => p.userId);
      const users = await User.find({ _id: { $in: memberIds } })
        .select("_id userName customName avatar")
        .lean();

      const members = activeMembers.map((p) => {
        const user = users.find(
          (u) => u._id.toString() === p.userId.toString()
        );
        return {
          userId: p.userId,
          userName: user?.userName,
          customName: user?.customName,
          avatar: user?.avatar,
          joinedAt: p.joinedAt,
          isAdmin: conversation.groupInfo?.admins?.some(
            (a) => a.toString() === p.userId.toString()
          ),
        };
      });

      res.json({
        success: true,
        data: {
          conversationId: conversation._id,
          type: conversation.type,
          groupInfo: {
            name: conversation.groupInfo?.name,
            avatar: conversation.groupInfo?.avatar,
            createdBy: conversation.groupInfo?.createdBy,
          },
          members,
          totalMembers: members.length,
          isAdmin: conversation.groupInfo?.admins?.some(
            (a) => a.toString() === userId.toString()
          ),
        },
      });
    }
  } catch (error) {
    console.error("Get conversation detail error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: PATCH /api/v1/conversation/:conversationId/nickname
module.exports.setNickname = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { nickname } = req.body;
    const userId = req.user.userId;

    // Lấy thông tin conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.userId": userId,
      type: "private",
    }).lean();

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Access denied or not a private conversation",
      });
    }

    // Tìm người kia
    const otherParticipant = conversation.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );

    if (!otherParticipant) {
      return res.status(404).json({
        success: false,
        error: "Other user not found",
      });
    }

    const otherUserId = otherParticipant.userId;

    // Xóa nickname cũ hoặc cập nhật
    if (!nickname || !nickname.trim()) {
      await Nickname.findOneAndDelete({
        setBy: userId,
        forUser: otherUserId,
      });
    } else {
      await Nickname.findOneAndUpdate(
        {
          setBy: userId,
          forUser: otherUserId,
        },
        {
          nickname: nickname.trim(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: "Nickname updated successfully",
    });
  } catch (error) {
    console.error("Set nickname error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: DELETE /api/v1/conversation/:conversationId
module.exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Thêm userId vào deletedFor (soft delete)
    await Conversation.findByIdAndUpdate(conversationId, {
      $addToSet: { deletedFor: userId },
    });

    res.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
