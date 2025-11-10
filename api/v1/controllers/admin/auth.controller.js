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
