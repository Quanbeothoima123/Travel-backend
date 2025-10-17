const AdminAccount = require("../../models/admin-account.model");
const Role = require("../../models/role.model");
const jwt = require("jsonwebtoken");
const md5 = require("md5");
// secret key JWT (bạn nên để trong biến môi trường .env)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = "7d";

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
    }).populate("role_id");

    if (!admin) {
      return res.status(401).json({ message: "Tài khoản không tồn tại" });
    }

    const hashedPassword = md5(password);
    if (admin.password !== hashedPassword) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role_id ? admin.role_id.title : "No Role",
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    // Gửi token qua cookie HTTP-only
    res.cookie("adminToken", token, {
      httpOnly: true, // ngăn JS đọc cookie
      secure: process.env.NODE_ENV === "production", // chỉ HTTPS khi production
      sameSite: "Strict", // tránh CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    return res.json({
      message: "Đăng nhập thành công",
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

// routes/admin.js
module.exports.checkAuth = async (req, res) => {
  try {
    const token = req.cookies.adminToken;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Vui lòng đăng nhập tài khoản quản trị!" });
    }

    // Giải mã token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Tìm admin
    const admin = await AdminAccount.findOne({
      _id: decoded.id,
      deleted: false,
      status: "active",
    }).select("-password");

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quản trị không hợp lệ hoặc đã bị khóa",
      });
    }
    return res.json({ admin: decoded });
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};
