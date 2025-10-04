const md5 = require("md5");
const User = require("../../models/user.model");
const Otp = require("../../models/otp.model"); // nhớ import Otp
const Ward = require("../../models/ward.model");
const Province = require("../../models/province.model");
const sendOtp = require("../../../../helpers/otpGenerator");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
// [POST] /api/v1/user/register
module.exports.register = async (req, res) => {
  try {
    const email = req.body.email;
    const emailExist = await User.findOne({ email: email });

    if (emailExist) {
      return res.json({
        code: 400,
        message:
          "Tài khoản của bạn đã đăng kí!, Nếu chưa xác thực hãy bấm nút xác thực tài khoản phía dưới!",
        userId: "",
        email: req.body.email,
        type: "register", // 👈 Thêm type để phân biệt
      });
    }
    const user = {
      fullName: req.body.fullName,
      email: req.body.email,
      password: md5(req.body.password),
    };
    const userSave = new User(user);
    await userSave.save();

    const subject = "Mã xác thực đăng ký tài khoản";
    await sendOtp.generateAndSendOtp(userSave.id, subject, req.body.email);

    return res.json({
      code: 200,
      message: "Vui lòng nhập mã xác thực để hoàn tất đăng kí tài khoản",
      userId: userSave.id,
      email: req.body.email,
      type: "register", // 👈 Thêm type để phân biệt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// [POST] /api/v1/user/auth
module.exports.auth = async (req, res) => {
  try {
    const { userId, otp, type } = req.body;

    const otpRecord = await Otp.findOne({ userId }).select("code expireAt");

    if (!otpRecord) {
      return res
        .status(400)
        .json({ message: "OTP không tồn tại hoặc đã hết hạn", type });
    }

    if (otpRecord.expireAt < new Date()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn", type });
    }

    if (otpRecord.code !== otp) {
      return res.status(400).json({ message: "Mã OTP không chính xác", type });
    }

    // Nếu OTP đúng, cập nhật user thành activer
    await User.updateOne({ _id: userId }, { status: "active" });

    // Xoá OTP đã dùng
    await Otp.deleteMany({ userId });

    return res.json({
      code: 200,
      message: "Xác thực thành công",
      userId,
      type, // 👈 Giữ lại type để frontend biết đang xử lý gì
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/resendOtp
module.exports.resendOtp = async (req, res) => {
  try {
    const { userId, email, type } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        message: "Thiếu thông tin userId hoặc email",
        type,
      });
    }

    // Xóa OTP cũ
    await Otp.deleteMany({ userId });

    // Gửi OTP mới
    const subject =
      type === "register"
        ? "Mã xác thực đăng ký tài khoản (gửi lại)"
        : "Mã OTP xác thực (gửi lại)";
    await sendOtp.generateAndSendOtp(userId, subject, email);

    return res.json({
      code: 200,
      message: "OTP mới đã được gửi, vui lòng kiểm tra email",
      userId,
      email,
      type, // 👈 frontend nhận để biết resend cho flow nào
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/reAuth
module.exports.reAuth = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Thiếu email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email không tồn tại" });
    }
    if (user.status === "active") {
      return res.status(404).json({
        message: "Tài khoản đã xác thực vui lòng không lảng vảng ở đây!",
      });
    }

    // Xóa OTP cũ
    await Otp.deleteMany({ userId: user._id });

    // Gửi lại OTP mới
    const subject = "Mã xác thực lại tài khoản";
    await sendOtp.generateAndSendOtp(user._id, subject, email);

    return res.json({
      code: 200,
      message: "OTP mới đã được gửi, vui lòng kiểm tra email",
      userId: user._id,
      email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/reInfo
module.exports.reInfo = async (req, res) => {
  try {
    const { userId, fullName, password } = req.body;

    if (!userId || !fullName || !password) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    // Hash password mới
    const hashPass = md5(password);

    // Update user info
    await User.findByIdAndUpdate(userId, {
      fullName,
      password: hashPass,
      status: "active",
    });

    return res.json({
      code: 200,
      message: "Cập nhật thông tin & xác thực thành công",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/login
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("password fullName");

    if (!user || md5(password) !== user.password) {
      return res.json({
        code: 400,
        message: "Sai mật khẩu hoặc tài khoản",
      });
    }

    // Tạo JWT
    const token = jwt.sign(
      { userId: user._id, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: "7d" } // token sống 7 ngày
    );

    // Set cookie (httpOnly để bảo mật hơn)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: false, // true nếu dùng HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      code: 200,
      message: "Đăng nhập thành công",
      token,
      fullName: user.fullName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
// [GET] /api/v1/user/me
module.exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "fullName email avatar"
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports.logout = (req, res) => {
  res.clearCookie("authToken");
  return res.json({ message: "Đăng xuất thành công" });
};
// [GET] /api/v1/user/user-profile
module.exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // từ token decode

    const user = await User.findById(userId)
      .select(
        "_id userName fullName customName email phone avatar address sex birthDay province ward friends nicknames friendRequestsSent friendRequestsReceived blockedUsers status createdAt updatedAt"
      )
      .populate("province")
      .populate("ward")
      .populate({
        path: "friends.user",
        select: "_id userName customName avatar",
      })
      .populate({
        path: "friendRequestsSent.user",
        select: "_id userName customName avatar",
      })
      .populate({
        path: "friendRequestsReceived.user",
        select: "_id userName customName avatar",
      })
      .populate({
        path: "blockedUsers.user",
        select: "_id userName customName avatar",
      })
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "Có lỗi trong quá trình lấy thông tin" });
    }

    // Loại bỏ các trường nhạy cảm
    const { password, securityCode, deleted, deletedAt, ...rest } = user;

    res.json(rest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/update-profile
module.exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      fullName,
      birthDay,
      sex,
      phone,
      avatar,
      address,
      province, // Object: {code, name, _id, ...}
      ward, // Object: {code, name, _id, ...}
    } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    // Cập nhật các field cơ bản
    if (fullName !== undefined) user.fullName = fullName;
    if (birthDay !== undefined) user.birthDay = new Date(birthDay);
    if (sex !== undefined) user.sex = sex;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (address !== undefined) user.address = address;

    // Xử lý province - nhận object từ frontend
    if (province && province._id) {
      const provinceDoc = await Province.findById(province._id);
      if (!provinceDoc)
        return res.status(400).json({ message: "Tỉnh/Thành không hợp lệ" });
      user.province = provinceDoc._id;

      // Reset ward khi đổi province
      if (!ward || ward.parent_code !== provinceDoc.code) {
        user.ward = undefined;
      }
    }

    // Xử lý ward - nhận object từ frontend
    if (ward && ward._id && user.province) {
      const wardDoc = await Ward.findById(ward._id);
      if (!wardDoc)
        return res.status(400).json({ message: "Phường/Xã không hợp lệ" });

      // Kiểm tra ward có thuộc province không
      const provinceDoc = await Province.findById(user.province);
      if (wardDoc.parent_code !== provinceDoc.code)
        return res.status(400).json({
          message: "Phường/Xã không thuộc tỉnh/thành đã chọn",
        });

      user.ward = wardDoc._id;
    }

    await user.save();

    // Populate để trả về full data như GET API
    const updatedUser = await User.findById(userId)
      .populate("province")
      .populate("ward")
      .select("-password");

    // QUAN TRỌNG: Trả về user object trực tiếp
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  Chức năng kết bạn
// POST /api/v1/user/profile/setup
module.exports.setupProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userName, customName, isAnonymous } = req.body;

    // Validate userName
    if (!userName || userName.trim().length < 3) {
      return res.status(400).json({
        message: "userName phải có ít nhất 3 ký tự",
      });
    }

    // Check userName exists
    const existingUser = await User.findOne({
      userName: userName.trim(),
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "userName đã được sử dụng",
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        userName: userName.trim(),
        customName: customName?.trim() || userName.trim(),
        isAnonymous: !!isAnonymous,
      },
      { new: true, runValidators: true }
    ).select("-password -securityCode");

    res.json(updatedUser);
  } catch (error) {
    console.error("Setup profile error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
// ==================== GET SUGGESTED FRIENDS ====================
// GET /api/v1/user/friends/suggestions - Get friend suggestions
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

    const currentUser = await User.findById(userId).lean();
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Lấy danh sách ID cần loại trừ
    const friendIds = currentUser.friends.map((f) => f.user.toString());
    const sentRequestIds = currentUser.friendRequestsSent.map((r) =>
      r.user.toString()
    );
    const receivedRequestIds = currentUser.friendRequestsReceived.map((r) =>
      r.user.toString()
    );
    const blockedIds = currentUser.blockedUsers.map((b) => b.user.toString());

    const excludeIds = [
      userId,
      ...friendIds,
      ...sentRequestIds,
      ...receivedRequestIds,
      ...blockedIds,
    ];

    // Query cơ bản: phải có userName và không phải anonymous
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
      query.province = province;
    }

    if (ward) {
      query.ward = ward;
    }

    if (sex) {
      query.sex = sex;
    }

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
    console.error("Get suggested friends error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET FRIENDS ====================
// GET /api/v1/user/friends - Get friends list
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

    const user = await User.findById(userId)
      .populate({
        path: "friends.user",
        select: "_id userName customName avatar province ward birthDay sex",
        match: { isAnonymous: { $ne: true } },
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let friends = user.friends.map((f) => f.user).filter(Boolean);

    // Apply filters
    if (userName) {
      friends = friends.filter(
        (f) =>
          f.userName?.toLowerCase().includes(userName.toLowerCase()) ||
          f.customName?.toLowerCase().includes(userName.toLowerCase())
      );
    }

    if (province) {
      friends = friends.filter((f) => f.province?.toString() === province);
    }

    if (ward) {
      friends = friends.filter((f) => f.ward?.toString() === ward);
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

    const total = friends.length;
    const skip = (page - 1) * limit;
    const items = friends.slice(skip, skip + parseInt(limit));
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
    console.error("Get friends error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET RECEIVED FRIEND REQUESTS ====================
// GET /api/v1/user/friend-requests/received - Get received friend requests
module.exports.getFriendRequestsReceived = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId)
      .populate({
        path: "friendRequestsReceived.user",
        select: "_id userName customName avatar",
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const requests = user.friendRequestsReceived
      .map((r) => ({
        _id: r.user?._id,
        userName: r.user?.userName,
        customName: r.user?.customName,
        avatar: r.user?.avatar,
        message: r.message,
        createdAt: r.createdAt,
      }))
      .filter((r) => r._id);

    const total = requests.length;
    const skip = (page - 1) * limit;
    const items = requests.slice(skip, skip + parseInt(limit));
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
    console.error("Get received requests error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET SENT FRIEND REQUESTS ====================
// GET /api/v1/user/friend-requests/sent - Get sent friend requests
module.exports.getFriendRequestsSent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId)
      .populate({
        path: "friendRequestsSent.user",
        select: "_id userName customName avatar",
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const requests = user.friendRequestsSent
      .map((r) => ({
        _id: r.user?._id,
        userName: r.user?.userName,
        customName: r.user?.customName,
        avatar: r.user?.avatar,
        message: r.message,
        createdAt: r.createdAt,
      }))
      .filter((r) => r._id);

    const total = requests.length;
    const skip = (page - 1) * limit;
    const items = requests.slice(skip, skip + parseInt(limit));
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
    console.error("Get sent requests error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== GET BLOCKED USERS ====================
// GET /api/v1/user/blocked - Get blocked users
module.exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId)
      .populate({
        path: "blockedUsers.user",
        select: "_id userName customName avatar",
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const blocked = user.blockedUsers
      .map((b) => ({
        _id: b.user?._id,
        userName: b.user?.userName,
        customName: b.user?.customName,
        avatar: b.user?.avatar,
        reason: b.reason,
        createdAt: b.createdAt,
      }))
      .filter((b) => b._id);

    const total = blocked.length;
    const skip = (page - 1) * limit;
    const items = blocked.slice(skip, skip + parseInt(limit));
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
    console.error("Get blocked users error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== SEND FRIEND REQUEST ====================
// POST /api/v1/user/friend-requests/send - Send friend request
module.exports.sendFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { toUserId, message } = req.body;

    if (!toUserId) {
      return res
        .status(400)
        .json({ success: false, error: "toUserId is required" });
    }

    // Check if receiver exists and not anonymous
    const receiver = await User.findById(toUserId);
    if (!receiver) {
      return res
        .status(404)
        .json({ success: false, error: "Người dùng không tồn tại" });
    }

    if (receiver.isAnonymous) {
      return res.status(403).json({
        success: false,
        error: "Không thể gửi lời mời đến người dùng ẩn danh",
      });
    }

    // Check if already friends
    const sender = await User.findById(userId);
    const alreadyFriends = sender.friends.some(
      (f) => f.user.toString() === toUserId
    );
    if (alreadyFriends) {
      return res.status(400).json({ success: false, error: "Đã là bạn bè" });
    }

    // Check if request already sent
    const alreadySent = sender.friendRequestsSent.some(
      (r) => r.user.toString() === toUserId
    );
    if (alreadySent) {
      return res
        .status(400)
        .json({ success: false, error: "Đã gửi lời mời rồi" });
    }

    // Add to sender's sent requests
    await User.findByIdAndUpdate(userId, {
      $push: {
        friendRequestsSent: {
          user: toUserId,
          message: message || "",
          createdAt: new Date(),
        },
      },
    });

    // Add to receiver's received requests
    await User.findByIdAndUpdate(toUserId, {
      $push: {
        friendRequestsReceived: {
          user: userId,
          message: message || "",
          createdAt: new Date(),
        },
      },
    });

    res.json({ success: true, message: "Đã gửi lời mời kết bạn" });
  } catch (error) {
    console.error("Send friend request error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== ACCEPT FRIEND REQUEST ====================
// POST /api/v1/user/friend-requests/accept - Accept friend request
module.exports.acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fromUserId } = req.body;

    if (!fromUserId) {
      return res
        .status(400)
        .json({ success: false, error: "fromUserId is required" });
    }

    // Add to both users' friends list
    await User.findByIdAndUpdate(userId, {
      $push: {
        friends: {
          user: fromUserId,
          createdAt: new Date(),
        },
      },
      $pull: {
        friendRequestsReceived: { user: fromUserId },
      },
    });

    await User.findByIdAndUpdate(fromUserId, {
      $push: {
        friends: {
          user: userId,
          createdAt: new Date(),
        },
      },
      $pull: {
        friendRequestsSent: { user: userId },
      },
    });

    res.json({ success: true, message: "Đã chấp nhận lời mời kết bạn" });
  } catch (error) {
    console.error("Accept friend request error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== REJECT FRIEND REQUEST ====================
// POST /api/v1/user/friend-requests/reject - Reject friend request
module.exports.rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fromUserId } = req.body;

    if (!fromUserId) {
      return res
        .status(400)
        .json({ success: false, error: "fromUserId is required" });
    }

    // Remove from receiver's received requests
    await User.findByIdAndUpdate(userId, {
      $pull: {
        friendRequestsReceived: { user: fromUserId },
      },
    });

    // Remove from sender's sent requests
    await User.findByIdAndUpdate(fromUserId, {
      $pull: {
        friendRequestsSent: { user: userId },
      },
    });

    res.json({ success: true, message: "Đã từ chối lời mời kết bạn" });
  } catch (error) {
    console.error("Reject friend request error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== CANCEL SENT REQUEST ====================
// DELETE /api/v1/user/friend-requests/cancel - Cancel sent friend request
module.exports.cancelSentRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { toUserId } = req.body;

    if (!toUserId) {
      return res
        .status(400)
        .json({ success: false, error: "toUserId is required" });
    }

    // Remove from sender's sent requests
    await User.findByIdAndUpdate(userId, {
      $pull: {
        friendRequestsSent: { user: toUserId },
      },
    });

    // Remove from receiver's received requests
    await User.findByIdAndUpdate(toUserId, {
      $pull: {
        friendRequestsReceived: { user: userId },
      },
    });

    res.json({ success: true, message: "Đã hủy lời mời kết bạn" });
  } catch (error) {
    console.error("Cancel sent request error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== UNFRIEND ====================
// DELETE /api/v1/user/friends/:friendId - Unfriend
module.exports.unfriend = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    if (!friendId) {
      return res
        .status(400)
        .json({ success: false, error: "friendId is required" });
    }

    // Remove from both users' friends list
    await User.findByIdAndUpdate(userId, {
      $pull: {
        friends: { user: friendId },
      },
    });

    await User.findByIdAndUpdate(friendId, {
      $pull: {
        friends: { user: userId },
      },
    });

    res.json({ success: true, message: "Đã hủy kết bạn" });
  } catch (error) {
    console.error("Unfriend error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== BLOCK USER ====================

// POST /api/v1/user/block - Block a user
module.exports.blockUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId, reason } = req.body;

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, error: "targetUserId is required" });
    }

    // Add to blocked list
    await User.findByIdAndUpdate(userId, {
      $push: {
        blockedUsers: {
          user: targetUserId,
          reason: reason || "",
          createdAt: new Date(),
        },
      },
      // Remove from friends if exists
      $pull: {
        friends: { user: targetUserId },
        friendRequestsSent: { user: targetUserId },
        friendRequestsReceived: { user: targetUserId },
      },
    });

    // Remove from target's friends list
    await User.findByIdAndUpdate(targetUserId, {
      $pull: {
        friends: { user: userId },
        friendRequestsSent: { user: userId },
        friendRequestsReceived: { user: userId },
      },
    });

    res.json({ success: true, message: "Đã chặn người dùng" });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};

// ==================== UNBLOCK USER ====================
// POST /api/v1/user/unblock - Unblock a user
module.exports.unblockUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, error: "targetUserId is required" });
    }

    // Remove from blocked list
    await User.findByIdAndUpdate(userId, {
      $pull: {
        blockedUsers: { user: targetUserId },
      },
    });

    res.json({ success: true, message: "Đã bỏ chặn người dùng" });
  } catch (error) {
    console.error("Unblock user error:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
};
