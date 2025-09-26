const jwt = require("jsonwebtoken");
const News = require("../../models/news.model");
const NewsCategory = require("../../models/new-category.model");
const AdminAccount = require("../../models/admin-account.model");
const User = require("../../models/user.model");
const Comment = require("../../models/comment.model");
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

//  Controller cho quản lý tin tức bên admin
// GET /api/admin/news/manager - Lấy danh sách tin tức với filter và phân trang cho trang quản lý
module.exports.getNewsList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      authorType = "",
      authorId = "",
      type = "",
      language = "",
      newsCategoryId = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query object
    let query = { deleted: false };

    // Search by title or author name
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      // Tìm kiếm author trước
      const adminAuthors = await AdminAccount.find({
        fullName: searchRegex,
        deleted: false,
      }).select("_id");

      const userAuthors = await User.find({
        fullName: searchRegex,
        deleted: false,
      }).select("_id");

      const adminAuthorIds = adminAuthors.map((author) => author._id);
      const userAuthorIds = userAuthors.map((author) => author._id);

      query.$or = [
        { title: searchRegex },
        {
          $and: [
            { "author.type": "admin" },
            { "author.id": { $in: adminAuthorIds } },
          ],
        },
        {
          $and: [
            { "author.type": "user" },
            { "author.id": { $in: userAuthorIds } },
          ],
        },
      ];
    }

    // Apply filters
    if (status) query.status = status;
    if (authorType) query["author.type"] = authorType;
    if (authorId) query["author.id"] = authorId;
    if (type) query.type = type;
    if (language) query.language = language;
    if (newsCategoryId) query.newsCategoryId = newsCategoryId;

    // Sort object
    let sortObj = {};
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    sortObj[sortBy] = sortDirection;

    // Execute query with pagination
    const [newsData, totalCount] = await Promise.all([
      News.find(query)
        .populate("newsCategoryId", "title slug")
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      News.countDocuments(query),
    ]);

    // Populate author information
    const newsWithAuthors = await Promise.all(
      newsData.map(async (news) => {
        let authorInfo = null;

        if (news.author.type === "admin") {
          authorInfo = await AdminAccount.findById(news.author.id)
            .select("fullName email avatar")
            .lean();
        } else if (news.author.type === "user") {
          authorInfo = await User.findById(news.author.id)
            .select("fullName email avatar")
            .lean();
        }

        // Get comment count for each news
        const commentCount = await Comment.countDocuments({
          targetId: news._id,
          targetType: "news",
          status: "approved",
        });

        return {
          ...news,
          authorInfo,
          commentCount,
          categoryInfo: news.newsCategoryId,
        };
      })
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tin tức thành công",
      data: newsWithAuthors,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("Error in getNewsList:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tin tức",
    });
  }
};

// GET /api/admin/news/:id - Lấy chi tiết một tin tức
module.exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await News.findOne({ _id: id, deleted: false })
      .populate("newsCategoryId", "title slug")
      .populate("destinationIds", "name slug")
      .populate("relatedTourIds", "title slug thumbnail")
      .lean();

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tức",
      });
    }

    // Get author info
    let authorInfo = null;
    if (news.author.type === "admin") {
      authorInfo = await AdminAccount.findById(news.author.id)
        .select("fullName email avatar phone")
        .lean();
    } else if (news.author.type === "user") {
      authorInfo = await User.findById(news.author.id)
        .select("fullName email avatar phone")
        .lean();
    }

    // Get comment count
    const commentCount = await Comment.countDocuments({
      targetId: news._id,
      targetType: "news",
      status: "approved",
    });

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin tin tức thành công",
      data: {
        ...news,
        authorInfo,
        commentCount,
      },
    });
  } catch (error) {
    console.error("Error in getNewsById:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin tin tức",
    });
  }
};

// DELETE /api/admin/news/:id - Xóa tin tức (soft delete)
module.exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin?._id; // Assuming you have admin info in req

    const news = await News.findOne({ _id: id, deleted: false });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tức",
      });
    }

    // Soft delete
    await News.findByIdAndUpdate(id, {
      deleted: true,
      deletedAt: new Date(),
      deletedBy: {
        _id: adminId,
        time: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Xóa tin tức thành công",
    });
  } catch (error) {
    console.error("Error in deleteNews:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa tin tức",
    });
  }
};

// GET /api/admin/news-categories - Lấy danh sách danh mục tin tức cho dropdown filter
module.exports.getNewsCategories = async (req, res) => {
  try {
    const categories = await NewsCategory.find({
      deleted: false,
      active: true,
    })
      .select("title slug parentId")
      .sort({ title: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Lấy danh mục tin tức thành công",
      data: categories,
    });
  } catch (error) {
    console.error("Error in getNewsCategories:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh mục tin tức",
    });
  }
};

// GET /api/admin/authors - Lấy danh sách tác giả (admin + user) cho dropdown filter
module.exports.getAuthors = async (req, res) => {
  try {
    const [adminAuthors, userAuthors] = await Promise.all([
      AdminAccount.find({
        deleted: false,
        status: "active",
      })
        .select("fullName email avatar")
        .sort({ fullName: 1 })
        .lean(),

      User.find({
        deleted: false,
        status: { $ne: "banned" },
      })
        .select("fullName email avatar")
        .sort({ fullName: 1 })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tác giả thành công",
      data: {
        admin: adminAuthors,
        user: userAuthors,
      },
    });
  } catch (error) {
    console.error("Error in getAuthors:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tác giả",
    });
  }
};

// PATCH /api/admin/news/:id/status - Cập nhật trạng thái tin tức (draft/published/archived)
module.exports.updateNewsStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.admin?._id;

    if (!["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const updateData = {
      status,
      updatedBy: {
        _id: adminId,
        time: new Date(),
      },
    };

    // If publishing, set publishedAt
    if (status === "published") {
      updateData.publishedAt = new Date();
    }

    const news = await News.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tức",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: news,
    });
  } catch (error) {
    console.error("Error in updateNewsStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái",
    });
  }
};
