// middlewares/checkAuth.js (User)
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports.checkAuth = (req, res, next) => {
  try {
    const token = req.cookies.authToken;

    // Nếu không có token, cho phép route public
    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // ✅ Gán FULL thông tin user vào req.user (từ JWT payload)
    req.user = decoded;

    return next();
  } catch (err) {
    // Token hết hạn hoặc không hợp lệ
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token đã hết hạn",
        code: "TOKEN_EXPIRED",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Token không hợp lệ",
      });
    }

    return res.status(500).json({
      message: "Lỗi xác thực",
    });
  }
};

// ✅ Middleware bắt buộc phải đăng nhập
module.exports.requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Vui lòng đăng nhập",
    });
  }
  next();
};
