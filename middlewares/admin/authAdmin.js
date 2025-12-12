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

    //  GẮN thông tin vào req và CHUYỂN TIẾP
    req.admin = admin;
    req.admin.adminId = admin._id;
    req.adminId = admin._id;
    next(); //  Quan trọng: gọi next() thay vì return JSON
  } catch (err) {
    console.error(" Lỗi xác thực admin:", err.message);

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

// Middleware kiểm tra quyền theo role title hoặc value
module.exports.checkRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // Kiểm tra xem checkAuth đã chạy chưa
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: "Vui lòng đăng nhập trước",
        });
      }

      // Kiểm tra role_id có tồn tại không
      if (!req.admin.role_id) {
        return res.status(403).json({
          success: false,
          message: "Tài khoản chưa được gán vai trò",
        });
      }

      const userRole = req.admin.role_id;

      // Kiểm tra theo cả title và value (linh hoạt hơn)
      const hasPermission =
        allowedRoles.includes(userRole.title) ||
        allowedRoles.includes(userRole.value);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Bạn không có quyền truy cập. Yêu cầu vai trò: ${allowedRoles.join(
            ", "
          )}`,
          requiredRoles: allowedRoles,
          yourRole: userRole.title || userRole.value,
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
