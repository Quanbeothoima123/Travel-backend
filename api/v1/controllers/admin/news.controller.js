const jwt = require("jsonwebtoken");
const News = require("../../models/news.model");

module.exports.create = async (req, res) => {
  try {
    const data = req.body;

    // Lấy token từ cookies
    const token = req.cookies?.adminToken;
    if (!token) {
      return res.status(401).json({ success: false, message: "Thiếu token" });
    }

    // Decode token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Token không hợp lệ" });
    }

    const adminId = decoded.id; // giả sử token có field id

    // Gắn thêm author & createdBy
    const news = new News({
      ...data,
      author: { type: "admin", id: adminId },
      createdBy: { _id: adminId, time: new Date() },
    });

    await news.save();

    return res.status(201).json({
      success: true,
      message: "Tạo bài viết thành công",
      data: news,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/news/published
 * Lấy danh sách bài viết đã publish
 */
module.exports.getPublishedNews = async (req, res) => {
  try {
    const news = await News.find({
      status: "published",
      deleted: false,
    })
      .sort({ publishedAt: -1 })
      .select("_id title slug thumbnail excerpt publishedAt views")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tin tức thành công",
      data: news,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra",
      error: error.message,
    });
  }
};
