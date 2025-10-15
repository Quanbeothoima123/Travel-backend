// middlewares/authAdmin.js
const jwt = require("jsonwebtoken");
const AdminAccount = require("../../api/v1/models/admin-account.model");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports.checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Vui lòng đăng nhập quản trị" });
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

    // Gắn thông tin admin vào request
    req.admin = admin;
    req.adminId = admin._id; //  gán riêng
    next();
  } catch (err) {
    console.error("❌ Lỗi xác thực admin:", err.message);

    // Xử lý lỗi cụ thể hơn
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token đã hết hạn, vui lòng đăng nhập lại",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ success: false, message: "Token không hợp lệ" });
    }

    return res
      .status(500)
      .json({ success: false, message: "Xác thực thất bại" });
  }
};
