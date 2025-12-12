// // middlewares/authAdmin.js
const jwt = require("jsonwebtoken");
const AdminAccount = require("../../api/v1/models/admin-account.model");
const JWT_SECRET = process.env.JWT_SECRET;
module.exports.checkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập quản trị",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded = { id: "...", email: "...", role: "Admin" }

    const admin = await AdminAccount.findOne({
      _id: decoded.id,
      deleted: false,
      status: "active",
    }).select("-password");
    //  KHÔNG CẦN .populate("role_id")

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quản trị không hợp lệ hoặc đã bị khóa",
      });
    }

    // Gắn thông tin vào req
    req.admin = admin;
    req.adminId = admin._id;
    req.admin.adminId = admin._id;
    req.role = decoded.role; //  LẤY ROLE TỪ TOKEN (không cần populate)

    next();
  } catch (err) {
    console.error("Lỗi xác thực admin:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token đã hết hạn, vui lòng làm mới token",
        code: "TOKEN_EXPIRED",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Xác thực thất bại",
    });
  }
};

module.exports.checkRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.role) {
        return res.status(401).json({
          success: false,
          message: "Vui lòng đăng nhập trước",
        });
      }

      if (!allowedRoles.includes(req.role)) {
        return res.status(403).json({
          success: false,
          message: `Bạn không có quyền truy cập. Yêu cầu vai trò: ${allowedRoles.join(
            ", "
          )}`,
          requiredRoles: allowedRoles,
          yourRole: req.role,
        });
      }

      next();
    } catch (err) {
      console.error("Lỗi kiểm tra quyền:", err.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi kiểm tra quyền",
      });
    }
  };
};
