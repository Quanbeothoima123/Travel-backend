const jwt = require("jsonwebtoken");
const AdminAccount = require("../../api/v1/models/admin-account.model");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports.checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;

    if (!token) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    // Giải mã token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Kiểm tra admin có tồn tại không
    const admin = await AdminAccount.findOne({
      _id: decoded.id,
      deleted: false,
      status: "active",
    });

    if (!admin) {
      return res
        .status(401)
        .json({ message: "Tài khoản không hợp lệ hoặc đã bị khóa" });
    }

    // Gắn thông tin admin vào request để các route khác dùng
    req.admin = admin;
    next();
  } catch (err) {
    console.error("Lỗi xác thực admin:", err);
    return res
      .status(401)
      .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
