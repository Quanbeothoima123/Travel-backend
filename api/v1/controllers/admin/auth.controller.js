// const AdminAccount = require("../../models/admin-account.model");
// const Role = require("../../models/role.model");
// const jwt = require("jsonwebtoken");
// const md5 = require("md5");
// // secret key JWT (bạn nên để trong biến môi trường .env)
// const JWT_SECRET = process.env.JWT_SECRET;
// const JWT_EXPIRES = "7d";

// // LOGIN
// module.exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(400).json({ message: "Thiếu email hoặc password" });
//     }

//     const admin = await AdminAccount.findOne({
//       email: email,
//       deleted: false,
//     }).populate("role_id");

//     if (!admin) {
//       return res.status(401).json({ message: "Tài khoản không tồn tại" });
//     }

//     const hashedPassword = md5(password);
//     if (admin.password !== hashedPassword) {
//       return res.status(401).json({ message: "Sai mật khẩu" });
//     }

//     const token = jwt.sign(
//       {
//         id: admin._id,
//         email: admin.email,
//         role: admin.role_id ? admin.role_id.title : "No Role",
//       },
//       JWT_SECRET,
//       { expiresIn: JWT_EXPIRES }
//     );

//     // 🔹 Cookie config cho cross-origin
//     res.cookie("adminToken", token, {
//       httpOnly: true,
//       secure: true, //  Bắt buộc true vì cả Vercel & Render đều HTTPS
//       sameSite: "None", //  Thay đổi từ 'Strict' sang 'None' cho cross-origin
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//       path: "/", // Đảm bảo cookie available cho tất cả routes
//     });

//     return res.json({
//       message: "Đăng nhập thành công",
//       admin: {
//         id: admin._id,
//         fullName: admin.fullName,
//         email: admin.email,
//         avatar: admin.avatar,
//         role: admin.role_id ? admin.role_id.title : null,
//         permissions: admin.role_id ? admin.role_id.permissions : [],
//       },
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     return res.status(500).json({ message: "Lỗi server" });
//   }
// };
// // routes/admin.js
// module.exports.checkAuth = async (req, res) => {
//   try {
//     const token = req.cookies.adminToken;
//     if (!token) {
//       return res
//         .status(401)
//         .json({ message: "Vui lòng đăng nhập tài khoản quản trị!" });
//     }

//     // Giải mã token
//     const decoded = jwt.verify(token, JWT_SECRET);

//     // Tìm admin
//     const admin = await AdminAccount.findOne({
//       _id: decoded.id,
//       deleted: false,
//       status: "active",
//     }).select("-password");

//     if (!admin) {
//       return res.status(403).json({
//         success: false,
//         message: "Tài khoản quản trị không hợp lệ hoặc đã bị khóa",
//       });
//     }
//     return res.json({ admin: decoded });
//   } catch (err) {
//     return res.status(401).json({ message: "Token không hợp lệ" });
//   }
// };

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

    // ✅ Dùng bcrypt.compare thay vì md5
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

    return res.json({
      message: "Đăng nhập thành công",
      accessToken,
      refreshToken,
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

// REGISTER ADMIN (nếu cần)
module.exports.register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Kiểm tra email đã tồn tại
    const existingAdmin = await AdminAccount.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // ✅ Hash password bằng bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Tạo admin mới
    const newAdmin = await AdminAccount.create({
      email,
      password: hashedPassword,
      fullName,
      status: "active",
    });

    return res.status(201).json({
      message: "Tạo tài khoản thành công",
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
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
module.exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Thiếu refresh token" });
    }

    // Tìm refresh token trong DB
    const tokenDoc = await RefreshToken.findOne({
      token: refreshToken,
      deleted: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res
        .status(401)
        .json({ message: "Refresh token không hợp lệ hoặc đã hết hạn" });
    }

    // Tìm admin
    const admin = await AdminAccount.findOne({
      _id: tokenDoc.admin_id,
      deleted: false,
      status: "active",
    }).populate("role_id");

    if (!admin) {
      return res.status(403).json({ message: "Tài khoản không hợp lệ" });
    }

    // Tạo Access Token mới
    const newAccessToken = generateAccessToken(admin);

    return res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
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

// LOGOUT
module.exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    return res.json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
