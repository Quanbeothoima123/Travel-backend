// controllers/friend.controller.js (NEW VERSION)
const User = require("../../models/user.model");
const Friend = require("../../models/friend.model");
const FriendRequest = require("../../models/friend-request.model");
const Block = require("../../models/block-friend.model");
const Province = require("../../models/province.model");
const Ward = require("../../models/ward.model");
// ==================== GET SUGGESTED FRIENDS ====================
// GET /api/v1/friends/suggestions
module.exports.getSuggestedFriends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      province,
      ward,
      birthYear,
      sex,
      userName,
    } = req.query;

    // Lấy danh sách ID cần loại trừ
    const [friends, sentRequests, receivedRequests, blockedUsers, blockedBy] =
      await Promise.all([
        Friend.find({
          $or: [{ userA: userId }, { userB: userId }],
        }).lean(),
        FriendRequest.find({ from: userId, status: "pending" }).distinct("to"),
        FriendRequest.find({ to: userId, status: "pending" }).distinct("from"),
        Block.find({ blocker: userId }).distinct("blocked"),
        Block.find({ blocked: userId }).distinct("blocker"),
      ]);

    // Lấy ra những id thật sự của bạn bè để loại bỏ trong suggest friend
    const friendIds = friends.map((f) =>
      f.userA.toString() === userId.toString()
        ? f.userB.toString()
        : f.userA.toString()
    );

    // Tạo danh sách id cần loại bỏ cho tính năng suggest friend
    const excludeIds = [
      userId.toString(),
      ...friendIds,
      ...sentRequests.map((id) => id.toString()),
      ...receivedRequests.map((id) => id.toString()),
      ...blockedUsers.map((id) => id.toString()),
      ...blockedBy.map((id) => id.toString()),
    ];

    // Query cơ bản
    let query = {
      _id: { $nin: excludeIds },
      userName: { $exists: true, $ne: null, $ne: "" },
      isAnonymous: { $ne: true },
      deleted: { $ne: true },
    };

    // Apply filters
    if (userName) {
      query.$or = [
        { userName: { $regex: userName, $options: "i" } },
        { customName: { $regex: userName, $options: "i" } },
      ];
    }

    if (province) {
      const provinceDoc = await Province.findOne({ code: province }).select(
        "_id"
      );
      if (provinceDoc) query.province = provinceDoc._id;
    }
    if (ward) {
      const wardDoc = await Ward.findOne({ code: ward }).select("_id");
      if (wardDoc) query.ward = wardDoc._id;
    }

    if (sex) query.sex = sex;

    // Query với pagination
    const total = await User.countDocuments(query);
    const skip = (page - 1) * limit;

    let users = await User.find(query)
      .select("_id userName customName avatar province ward birthDay sex")
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter by birthYear nếu có
    if (birthYear) {
      users = users.filter((u) => {
        if (!u.birthDay) return false;
        const year = new Date(u.birthDay).getFullYear();
        return year === parseInt(birthYear);
      });
    }

    const nextPageExists = skip + users.length < total;

    res.json({
      success: true,
      data: {
        items: users,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        nextPageExists,
      },
    });
  } catch (error) {
    console.error("Lỗi hàm getSuggestedFriends:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET FRIENDS ====================
// GET /api/v1/friends/list
module.exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      province,
      ward,
      birthYear,
      sex,
      userName,
    } = req.query;

    // Lấy danh sách bạn bè
    const friendships = await Friend.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate({
        path: "userA userB",
        select: "_id userName customName avatar province ward birthDay sex",
        match: { isAnonymous: { $ne: true } },
        populate: [
          { path: "province", select: "code name name_with_type" },
          { path: "ward", select: "code name name_with_type" },
        ],
      })
      .lean();

    // Lấy danh sách bạn bè thực sự (bỏ chính mình)
    let friends = friendships
      .map((f) => {
        const friend =
          f.userA._id.toString() === userId.toString() ? f.userB : f.userA;
        return friend;
      })
      .filter(Boolean);

    // --- Apply filters ---
    if (userName) {
      friends = friends.filter(
        (f) =>
          f.userName?.toLowerCase().includes(userName.toLowerCase()) ||
          f.customName?.toLowerCase().includes(userName.toLowerCase())
      );
    }

    if (province) {
      friends = friends.filter((f) => f.province?.code === province);
    }

    if (ward) {
      friends = friends.filter((f) => f.ward?.code === ward);
    }

    if (birthYear) {
      friends = friends.filter((f) => {
        if (!f.birthDay) return false;
        const year = new Date(f.birthDay).getFullYear();
        return year === parseInt(birthYear);
      });
    }

    if (sex) {
      friends = friends.filter((f) => f.sex === sex);
    }

    // --- Pagination ---
    const total = friends.length;
    const skip = (page - 1) * limit;
    const items = friends.slice(skip, skip + parseInt(limit));
    const nextPageExists = skip + items.length < total;

    // --- Response ---
    res.json({
      success: true,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        nextPageExists,
      },
    });
  } catch (error) {
    console.error("Lỗi hàm getFriends:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET RECEIVED FRIEND REQUESTS ====================
// GET /api/v1/friends/friend-requests/received
module.exports.getFriendRequestsReceived = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const total = await FriendRequest.countDocuments({
      to: userId,
      status: "pending",
    });

    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find({
      to: userId,
      status: "pending",
    })
      .populate({
        path: "from",
        select: "_id userName customName avatar",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const items = requests.map((r) => ({
      _id: r.from._id,
      userName: r.from.userName,
      customName: r.from.customName,
      avatar: r.from.avatar,
      message: r.message,
      createdAt: r.createdAt,
    }));

    const nextPageExists = skip + items.length < total;

    res.json({
      success: true,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        nextPageExists,
      },
    });
  } catch (error) {
    console.error("Lỗi hàm getFriendRequestsReceived:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET SENT FRIEND REQUESTS ====================
// GET /api/v1/friends/friend-requests/sent
module.exports.getFriendRequestsSent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const total = await FriendRequest.countDocuments({
      from: userId,
      status: "pending",
    });

    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find({
      from: userId,
      status: "pending",
    })
      .populate({
        path: "to",
        select: "_id userName customName avatar",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const items = requests.map((r) => ({
      _id: r.to._id,
      userName: r.to.userName,
      customName: r.to.customName,
      avatar: r.to.avatar,
      message: r.message,
      createdAt: r.createdAt,
    }));

    const nextPageExists = skip + items.length < total;

    res.json({
      success: true,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        nextPageExists,
      },
    });
  } catch (error) {
    console.error("Lỗi hàm getFriendRequestsSent:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET BLOCKED USERS ====================
// GET /api/v1/friends/blocked/list
module.exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const total = await Block.countDocuments({ blocker: userId });
    const skip = (page - 1) * limit;

    const blocks = await Block.find({ blocker: userId })
      .populate({
        path: "blocked",
        select: "_id userName customName avatar",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const items = blocks.map((b) => ({
      _id: b.blocked._id,
      userName: b.blocked.userName,
      customName: b.blocked.customName,
      avatar: b.blocked.avatar,
      reason: b.reason,
      createdAt: b.createdAt,
    }));

    const nextPageExists = skip + items.length < total;

    res.json({
      success: true,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        nextPageExists,
      },
    });
  } catch (error) {
    console.error("Lỗi hàm getBlockedUsers:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== SEND FRIEND REQUEST ====================
// POST /api/v1/friends/friend-requests/send
module.exports.sendFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { toUserId, message } = req.body;

    if (!toUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Không tìm thấy người nhận" });
    }

    // Check if receiver exists and not anonymous
    const receiver = await User.findById(toUserId);
    if (!receiver) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    if (receiver.isAnonymous) {
      return res.status(403).json({
        success: false,
        message: "Không thể gửi lời mời đến người dùng ẩn danh",
      });
    }

    // Check if blocked
    const isBlocked = await Block.findOne({
      $or: [
        { blocker: userId, blocked: toUserId },
        { blocker: toUserId, blocked: userId },
      ],
    });

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message:
          "Không thể gửi lời mời kết bạn(Bạn hoặc người đó đã chặn nhau)",
      });
    }

    // Check if already friends
    const alreadyFriends = await Friend.findOne({
      $or: [
        { userA: userId, userB: toUserId },
        { userA: toUserId, userB: userId },
      ],
    });

    if (alreadyFriends) {
      return res
        .status(400)
        .json({ success: false, message: "Hai người đã là bạn bè!" });
    }

    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      from: userId,
      to: toUserId,
      status: "pending",
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ success: false, message: "Đã gửi lời mời rồi" });
    }

    // Create friend request
    await FriendRequest.create({
      from: userId,
      to: toUserId,
      message: message || "",
      status: "pending",
    });

    res.json({ success: true, message: "Đã gửi lời mời kết bạn" });
  } catch (error) {
    console.error("Lỗi hàm sendFriendRequest:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== ACCEPT FRIEND REQUEST ====================
// POST /api/v1/friends/friend-requests/accept
module.exports.acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fromUserId } = req.body;

    if (!fromUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thấy thông tin người gửi" });
    }

    // Find and update request
    const request = await FriendRequest.findOne({
      from: fromUserId,
      to: userId,
      status: "pending",
    });

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Lời mời không tồn tại" });
    }

    // Update status
    request.status = "accepted";
    await request.save();

    // Create friendship
    await Friend.create({
      userA: userId,
      userB: fromUserId,
    });

    res.json({ success: true, message: "Đã chấp nhận lời mời kết bạn" });
  } catch (error) {
    console.error("Lỗi hàm acceptFriendRequest:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== REJECT FRIEND REQUEST ====================
// POST /api/v1/friends/friend-requests/reject
module.exports.rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fromUserId } = req.body;

    if (!fromUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thấy thông tin người gửi" });
    }

    // Find and update request
    const request = await FriendRequest.findOne({
      from: fromUserId,
      to: userId,
      status: "pending",
    });

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Lời mời không tồn tại" });
    }

    // Update status
    request.status = "rejected";
    await request.save();

    res.json({ success: true, message: "Đã từ chối lời mời kết bạn" });
  } catch (error) {
    console.error("Lỗi hàm rejectFriendRequest:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== CANCEL SENT REQUEST ====================
// DELETE /api/v1/friends/friend-requests/cancel
module.exports.cancelSentRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { toUserId } = req.body;

    if (!toUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thấy thông tin người nhận" });
    }

    // Find and update request
    const request = await FriendRequest.findOne({
      from: userId,
      to: toUserId,
      status: "pending",
    });

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Lời mời không tồn tại" });
    }

    // Update status
    request.status = "canceled";
    await request.save();

    res.json({ success: true, message: "Đã hủy lời mời kết bạn" });
  } catch (error) {
    console.error("Lỗi hàm cancelSentRequest:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== UNFRIEND ====================
// DELETE /api/v1/friends/un-friend/:friendId
module.exports.unfriend = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    if (!friendId) {
      return res
        .status(400)
        .json({ success: false, message: "Không tìm thấy người bạn này" });
    }

    // Delete friendship
    const result = await Friend.findOneAndDelete({
      $or: [
        { userA: userId, userB: friendId },
        { userA: friendId, userB: userId },
      ],
    });

    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bạn bè" });
    }

    res.json({ success: true, message: "Đã hủy kết bạn" });
  } catch (error) {
    console.error("lỗi hàm unfriend:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== BLOCK USER ====================
// POST /api/v1/friends/block
module.exports.blockUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId, reason } = req.body;

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, error: "Không thấy người chỉ định" });
    }

    // Check if already blocked
    const existingBlock = await Block.findOne({
      blocker: userId,
      blocked: targetUserId,
    });

    if (existingBlock) {
      return res
        .status(400)
        .json({ success: false, message: "Đã chặn người dùng này rồi" });
    }

    // Create block
    await Block.create({
      blocker: userId,
      blocked: targetUserId,
      reason: reason || "",
    });

    // Remove friendship if exists
    await Friend.findOneAndDelete({
      $or: [
        { userA: userId, userB: targetUserId },
        { userA: targetUserId, userB: userId },
      ],
    });

    // Cancel pending friend requests
    await FriendRequest.updateMany(
      {
        $or: [
          { from: userId, to: targetUserId },
          { from: targetUserId, to: userId },
        ],
        status: "pending",
      },
      { status: "canceled" }
    );

    res.json({ success: true, message: "Đã chặn người dùng" });
  } catch (error) {
    console.error("Lỗi hàm blockUser:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== UNBLOCK USER ====================
// POST /api/v1/friends/unblock
module.exports.unblockUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thấy người chỉ định" });
    }

    // Delete block
    const result = await Block.findOneAndDelete({
      blocker: userId,
      blocked: targetUserId,
    });

    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Chưa chặn người dùng này" });
    }

    res.json({ success: true, message: "Đã bỏ chặn người dùng" });
  } catch (error) {
    console.error("Lỗi hàm unblockUser:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};
