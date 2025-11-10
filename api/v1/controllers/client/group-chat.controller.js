// controllers/groupChat.controller.js
const Conversation = require("../../models/conversation.model");
const User = require("../../models/user.model");
const Friend = require("../../models/friend.model");
const Message = require("../../models/message.model");

// ==================== CREATE GROUP ====================
// POST /api/v1/group/create
module.exports.createGroup = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, memberIds, avatar } = req.body;

    // Validate
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Tên nhóm không được để trống",
      });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Phải có ít nhất 1 thành viên",
      });
    }

    // Loại bỏ duplicate và user hiện tại
    const uniqueMemberIds = [...new Set(memberIds)].filter(
      (id) => id.toString() !== userId.toString()
    );

    if (uniqueMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Phải có ít nhất 1 thành viên khác ngoài bạn",
      });
    }

    // Kiểm tra tất cả members phải là bạn bè
    const friendships = await Friend.find({
      $or: [
        { userA: userId, userB: { $in: uniqueMemberIds } },
        { userA: { $in: uniqueMemberIds }, userB: userId },
      ],
    });

    const friendIds = friendships.map((f) =>
      f.userA.toString() === userId.toString()
        ? f.userB.toString()
        : f.userA.toString()
    );

    const notFriends = uniqueMemberIds.filter(
      (id) => !friendIds.includes(id.toString())
    );

    if (notFriends.length > 0) {
      return res.status(403).json({
        success: false,
        error: "Chỉ có thể thêm bạn bè vào nhóm",
        notFriends,
      });
    }

    // Tạo participants array
    const participants = [
      { userId: userId, joinedAt: new Date() },
      ...uniqueMemberIds.map((id) => ({
        userId: id,
        joinedAt: new Date(),
      })),
    ];

    // Tạo unreadCounts Map
    const unreadCounts = new Map();
    [userId, ...uniqueMemberIds].forEach((id) => {
      unreadCounts.set(id.toString(), 0);
    });

    // Tạo group conversation
    const conversation = await Conversation.create({
      type: "group",
      participants,
      groupInfo: {
        name: name.trim(),
        avatar: avatar || null,
        createdBy: userId,
        admins: [userId], // Người tạo là admin
      },
      lastMessageAt: new Date(),
      unreadCounts,
    });

    // Tạo system message
    const creator = await User.findById(userId).select("customName userName");
    await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: `${creator.customName || creator.userName} đã tạo nhóm`,
      type: "system",
    });

    // Populate và trả về
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("participants.userId", "userName customName avatar")
      .lean();

    res.json({
      success: true,
      message: "Tạo nhóm thành công",
      data: populatedConversation,
    });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== ADD MEMBERS ====================
// POST /api/v1/group/:conversationId/add-members
module.exports.addMembers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { memberIds } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Phải có ít nhất 1 thành viên",
      });
    }

    // Kiểm tra conversation và quyền
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Không tìm thấy nhóm hoặc bạn không có quyền",
      });
    }

    // Loại bỏ duplicate
    const uniqueMemberIds = [...new Set(memberIds)];

    // Kiểm tra members đã có trong nhóm chưa
    const existingMemberIds = conversation.participants.map((p) =>
      p.userId.toString()
    );
    const newMemberIds = uniqueMemberIds.filter(
      (id) => !existingMemberIds.includes(id.toString())
    );

    if (newMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Tất cả thành viên đã có trong nhóm",
      });
    }

    // Kiểm tra người thêm phải là bạn bè với người được thêm
    const friendships = await Friend.find({
      $or: [
        { userA: userId, userB: { $in: newMemberIds } },
        { userA: { $in: newMemberIds }, userB: userId },
      ],
    });

    const friendIds = friendships.map((f) =>
      f.userA.toString() === userId.toString()
        ? f.userB.toString()
        : f.userA.toString()
    );

    const notFriends = newMemberIds.filter(
      (id) => !friendIds.includes(id.toString())
    );

    if (notFriends.length > 0) {
      return res.status(403).json({
        success: false,
        error: "Chỉ có thể thêm bạn bè vào nhóm",
        notFriends,
      });
    }

    // Thêm members
    const newParticipants = newMemberIds.map((id) => ({
      userId: id,
      joinedAt: new Date(),
    }));

    conversation.participants.push(...newParticipants);

    // Cập nhật unreadCounts
    const unreadCounts = conversation.unreadCounts || new Map();
    newMemberIds.forEach((id) => {
      unreadCounts.set(id.toString(), 0);
    });
    conversation.unreadCounts = unreadCounts;

    await conversation.save();

    // Tạo system message
    const adder = await User.findById(userId).select("customName userName");
    const addedUsers = await User.find({ _id: { $in: newMemberIds } }).select(
      "customName userName"
    );
    const addedNames = addedUsers
      .map((u) => u.customName || u.userName)
      .join(", ");

    await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: `${
        adder.customName || adder.userName
      } đã thêm ${addedNames} vào nhóm`,
      type: "system",
    });

    res.json({
      success: true,
      message: "Thêm thành viên thành công",
    });
  } catch (error) {
    console.error("Add members error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== REMOVE MEMBER ====================
// POST /api/v1/group/:conversationId/remove-member
module.exports.removeMember = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        error: "memberId là bắt buộc",
      });
    }

    // Kiểm tra conversation và quyền admin
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      "groupInfo.admins": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Chỉ admin mới có thể xóa thành viên",
      });
    }

    // Không thể xóa admin khác
    if (conversation.groupInfo.admins.some((a) => a.toString() === memberId)) {
      return res.status(403).json({
        success: false,
        error: "Không thể xóa admin",
      });
    }

    // Xóa member
    conversation.participants = conversation.participants.filter(
      (p) => p.userId.toString() !== memberId.toString()
    );

    // Xóa khỏi unreadCounts
    const unreadCounts = conversation.unreadCounts || new Map();
    unreadCounts.delete(memberId.toString());
    conversation.unreadCounts = unreadCounts;

    await conversation.save();

    // Tạo system message
    const remover = await User.findById(userId).select("customName userName");
    const removedUser = await User.findById(memberId).select(
      "customName userName"
    );

    await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: `${remover.customName || remover.userName} đã xóa ${
        removedUser.customName || removedUser.userName
      } khỏi nhóm`,
      type: "system",
    });

    res.json({
      success: true,
      message: "Xóa thành viên thành công",
    });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== LEAVE GROUP ====================
// POST /api/v1/group/:conversationId/leave
module.exports.leaveGroup = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      "participants.userId": userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy nhóm",
      });
    }

    // Nếu là admin duy nhất và còn members khác
    const isOnlyAdmin =
      conversation.groupInfo.admins.length === 1 &&
      conversation.groupInfo.admins[0].toString() === userId.toString();

    const otherMembers = conversation.participants.filter(
      (p) => p.userId.toString() !== userId.toString()
    );

    if (isOnlyAdmin && otherMembers.length > 0) {
      return res.status(400).json({
        success: false,
        error:
          "Bạn là admin duy nhất. Hãy chỉ định admin mới trước khi rời nhóm",
      });
    }

    // Mark leftAt
    const participant = conversation.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );
    if (participant) {
      participant.leftAt = new Date();
    }

    // Xóa khỏi admins nếu có
    conversation.groupInfo.admins = conversation.groupInfo.admins.filter(
      (a) => a.toString() !== userId.toString()
    );

    await conversation.save();

    // Tạo system message
    const leaver = await User.findById(userId).select("customName userName");
    await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: `${leaver.customName || leaver.userName} đã rời khỏi nhóm`,
      type: "system",
    });

    res.json({
      success: true,
      message: "Rời nhóm thành công",
    });
  } catch (error) {
    console.error("Leave group error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== PROMOTE TO ADMIN ====================
// POST /api/v1/group/:conversationId/promote
module.exports.promoteToAdmin = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        error: "memberId là bắt buộc",
      });
    }

    // Kiểm tra quyền admin
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      "groupInfo.admins": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Chỉ admin mới có thể thăng quyền",
      });
    }

    // Kiểm tra member có trong nhóm không
    const isMember = conversation.participants.some(
      (p) => p.userId.toString() === memberId.toString() && !p.leftAt
    );

    if (!isMember) {
      return res.status(404).json({
        success: false,
        error: "Người dùng không trong nhóm",
      });
    }

    // Kiểm tra đã là admin chưa
    if (conversation.groupInfo.admins.some((a) => a.toString() === memberId)) {
      return res.status(400).json({
        success: false,
        error: "Người dùng đã là admin",
      });
    }

    // Thêm vào admins
    conversation.groupInfo.admins.push(memberId);
    await conversation.save();

    // Tạo system message
    const promoter = await User.findById(userId).select("customName userName");
    const promoted = await User.findById(memberId).select(
      "customName userName"
    );

    await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: `${promoter.customName || promoter.userName} đã thăng ${
        promoted.customName || promoted.userName
      } làm quản trị viên`,
      type: "system",
    });

    res.json({
      success: true,
      message: "Thăng quyền thành công",
    });
  } catch (error) {
    console.error("Promote to admin error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== UPDATE GROUP INFO ====================
// PATCH /api/v1/group/:conversationId/update
module.exports.updateGroupInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { name, avatar } = req.body;

    // Kiểm tra quyền admin
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      "groupInfo.admins": userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Chỉ admin mới có thể cập nhật thông tin nhóm",
      });
    }

    // Update
    if (name && name.trim()) {
      conversation.groupInfo.name = name.trim();
    }

    if (avatar !== undefined) {
      conversation.groupInfo.avatar = avatar;
    }

    await conversation.save();

    // Tạo system message
    const updater = await User.findById(userId).select("customName userName");
    await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      content: `${
        updater.customName || updater.userName
      } đã cập nhật thông tin nhóm`,
      type: "system",
    });

    res.json({
      success: true,
      message: "Cập nhật thông tin nhóm thành công",
      data: conversation.groupInfo,
    });
  } catch (error) {
    console.error("Update group info error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET GROUP DETAIL ====================
// GET /api/v1/group/:conversationId
module.exports.getGroupDetail = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      "participants.userId": userId,
    })
      .populate("participants.userId", "userName customName avatar")
      .populate("groupInfo.admins", "userName customName avatar")
      .lean();

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: "Không tìm thấy nhóm hoặc bạn không có quyền",
      });
    }

    // Filter active members (chưa rời nhóm)
    const activeMembers = conversation.participants.filter((p) => !p.leftAt);

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        type: conversation.type,
        groupInfo: conversation.groupInfo,
        members: activeMembers,
        totalMembers: activeMembers.length,
      },
    });
  } catch (error) {
    console.error("Get group detail error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};
