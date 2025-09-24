const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports.checkAuth = (req, res, next) => {
  const token = req.cookies.authToken;
  if (!token) {
    req.user = null; // route public vẫn vào
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};
