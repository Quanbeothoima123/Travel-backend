// middlewares/authAdmin.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  const token = req.cookies.adminToken; // lấy token từ cookie
  if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded; // gắn thông tin vào req để route dùng
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};
