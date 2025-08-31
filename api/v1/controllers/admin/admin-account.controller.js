const AdminAccount = require("../../models/admin-account.model");
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

    const user = await AdminAccount.findOne({
      email: email,
      deleted: false,
    }).populate("role_id");

    if (!user) {
      return res.status(401).json({ message: "Tài khoản không tồn tại" });
    }

    const hashedPassword = md5(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role_id ? user.role_id.title : "No Role",
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
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        role: user.role_id ? user.role_id.title : null,
        permissions: user.role_id ? user.role_id.permissions : [],
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
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ user: decoded });
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};
