// controllers/admin/auth.controller.js
const AdminAccount = require("../../models/admin-account.model");
const RefreshToken = require("../../models/refresh-token.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // ✅ Thay md5 bằng bcrypt
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES = "15m"; // 15 phút
const REFRESH_TOKEN_EXPIRES = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const SALT_ROUNDS = 10; // Độ phức tạp của bcrypt
const { logBusiness } = require("../../../../services/businessLog.service");
const { sendToQueue } = require("../../../../config/rabbitmq");
// Hàm tạo Access Token
const generateAccessToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role_id ? admin.role_id.title : "No Role",
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
};

// Hàm tạo Refresh Token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

// LOGIN
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Thiếu email hoặc password" });
    }

    const admin = await AdminAccount.findOne({
      email: email,
      deleted: false,
      status: "active",
    }).populate("role_id");

    if (!admin) {
      return res.status(401).json({ message: "Tài khoản không tồn tại" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }

    // Tạo Access Token
    const accessToken = generateAccessToken(admin);

    // Tạo Refresh Token
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES);

    // Lưu Refresh Token vào DB
    await RefreshToken.create({
      admin_id: admin._id,
      token: refreshToken,
      expiresAt: expiresAt,
    });

    // ✅ LƯU REFRESH TOKEN VÀO HTTPONLY COOKIE
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // JavaScript không thể đọc
      secure: true, // BẮT BUỘC true với SameSite=None
      sameSite: "none", // Cho phép cross-origin (frontend khác domain)
      maxAge: REFRESH_TOKEN_EXPIRES, // 7 ngày (ms)
    });

    // ❌ KHÔNG trả refreshToken trong JSON nữa
    return res.json({
      message: "Đăng nhập thành công",
      accessToken, // ← Chỉ trả accessToken
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        avatar: admin.avatar,
        role: admin.role_id ? admin.role_id.title : null,
        permissions: admin.role_id ? admin.role_id.permissions : [],
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// CHANGE PASSWORD
module.exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminId = req.adminId; // Từ middleware checkAuth

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    const admin = await AdminAccount.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // ✅ Kiểm tra mật khẩu cũ
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      admin.password
    );
    if (!isOldPasswordValid) {
      return res.status(401).json({ message: "Mật khẩu cũ không đúng" });
    }

    // ✅ Hash mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    admin.password = hashedNewPassword;
    await admin.save();

    return res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// REFRESH TOKEN
// ✅ Refresh Token - Lấy từ cookie
module.exports.refreshToken = async (req, res) => {
  try {
    // ✅ Lấy refreshToken từ cookie thay vì req.body
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    // Kiểm tra token trong DB
    const tokenRecord = await RefreshToken.findOne({
      token: refreshToken,
      expiresAt: { $gt: new Date() },
    }).populate("admin_id");

    if (!tokenRecord) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Tạo access token mới
    const newAccessToken = generateAccessToken(tokenRecord.admin_id);

    return res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// ✅ Logout - Xóa cookie
module.exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      // Xóa token khỏi DB
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    // ✅ XÓA COOKIE
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// CHECK AUTH
module.exports.checkAuth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Vui lòng đăng nhập!" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const admin = await AdminAccount.findOne({
      _id: decoded.id,
      deleted: false,
      status: "active",
    })
      .select("-password")
      .populate("role_id");

    if (!admin) {
      return res.status(403).json({ message: "Tài khoản không hợp lệ" });
    }

    return res.json({
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        avatar: admin.avatar,
        role: admin.role_id ? admin.role_id.title : null,
        permissions: admin.role_id ? admin.role_id.permissions : [],
      },
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token đã hết hạn" });
    }
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};

module.exports.getProfile = async (req, res) => {
  try {
    const account = await AdminAccount.findOne({
      _id: req.admin._id,
      deleted: false,
    })
      .populate("role_id", "title value description permissions")
      .select("-password")
      .lean();

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.json({
      success: true,
      profile: account,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin profile",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/profile/update - Cập nhật thông tin profile
module.exports.updateProfile = async (req, res) => {
  try {
    const accountId = req.admin._id;
    const { fullName, phone, avatar } = req.body;

    const account = await AdminAccount.findOne({
      _id: accountId,
      deleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Lưu dữ liệu cũ để log
    const oldData = {
      fullName: account.fullName,
      phone: account.phone,
      avatar: account.avatar,
    };

    // Build update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;

    // Update account
    await AdminAccount.findByIdAndUpdate(accountId, updateData);

    // Get updated account
    const updatedAccount = await AdminAccount.findById(accountId)
      .populate("role_id", "title value description permissions")
      .select("-password")
      .lean();

    // ✅ GHI LOG NGHIỆP VỤ
    await logBusiness({
      adminId: req.admin._id,
      adminName: req.admin.fullName,
      action: "update",
      model: "AdminAccount",
      recordIds: [accountId],
      description: `${req.admin.fullName} đã cập nhật thông tin cá nhân`,
      details: {
        before: oldData,
        after: {
          fullName: updatedAccount.fullName,
          phone: updatedAccount.phone,
          avatar: updatedAccount.avatar,
        },
      },
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // ✅ GỬI NOTIFICATION QUA RABBITMQ
    await sendToQueue("notifications.admin", {
      type: "profile_updated",
      adminId: req.admin._id.toString(),
      adminName: req.admin.fullName,
      message: `${req.admin.fullName} đã cập nhật thông tin cá nhân`,
      timestamp: new Date().toISOString(),
      data: {
        changes: Object.keys(updateData),
      },
    });

    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      profile: updatedAccount,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật thông tin",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/profile/change-password - Đổi mật khẩu
module.exports.changePassword = async (req, res) => {
  try {
    const accountId = req.admin._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới và xác nhận mật khẩu không khớp",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    // Get account with password
    const account = await AdminAccount.findOne({
      _id: accountId,
      deleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      account.password
    );

    if (!isPasswordValid) {
      // ✅ LOG ATTEMPT FAILED
      await logBusiness({
        adminId: req.admin._id,
        adminName: req.admin.fullName,
        action: "update",
        model: "AdminAccount",
        recordIds: [accountId],
        description: `${req.admin.fullName} đã thử đổi mật khẩu nhưng mật khẩu hiện tại không đúng`,
        details: {
          status: "failed",
          reason: "Incorrect current password",
        },
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
      });

      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await AdminAccount.findByIdAndUpdate(accountId, {
      password: hashedPassword,
    });

    // ✅ GHI LOG NGHIỆP VỤ
    await logBusiness({
      adminId: req.admin._id,
      adminName: req.admin.fullName,
      action: "update",
      model: "AdminAccount",
      recordIds: [accountId],
      description: `${req.admin.fullName} đã đổi mật khẩu thành công`,
      details: {
        action: "password_changed",
        timestamp: new Date().toISOString(),
      },
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // ✅ GỬI NOTIFICATION QUA RABBITMQ (cảnh báo bảo mật)
    await sendToQueue("notifications.admin", {
      type: "password_changed",
      adminId: req.admin._id.toString(),
      adminName: req.admin.fullName,
      message: `Mật khẩu của tài khoản ${req.admin.fullName} đã được thay đổi`,
      timestamp: new Date().toISOString(),
      priority: "high", // Đánh dấu quan trọng
      data: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đổi mật khẩu",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/profile/stats - Lấy thống kê hoạt động
module.exports.getStats = async (req, res) => {
  try {
    const accountId = req.admin._id;

    const account = await AdminAccount.findOne({
      _id: accountId,
      deleted: false,
    }).select("createdAt lastLogin");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Tính số ngày đã tham gia
    const daysJoined = Math.floor(
      (new Date() - account.createdAt) / (1000 * 60 * 60 * 24)
    );

    res.json({
      success: true,
      stats: {
        accountCreated: account.createdAt,
        lastLogin: account.lastLogin,
        daysJoined,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê",
      error: error.message,
    });
  }
};
