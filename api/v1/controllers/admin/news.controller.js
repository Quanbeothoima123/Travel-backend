const jwt = require("jsonwebtoken");
const News = require("../../models/news.model");
const NewsCategory = require("../../models/new-category.model");
const AdminAccount = require("../../models/admin-account.model");
const User = require("../../models/user.model");
const Comment = require("../../models/comment.model");
const mongoose = require("mongoose");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");
const { sendToQueue } = require("../../../../config/rabbitmq");
const { logBusiness } = require("../../../../services/businessLog.service");
module.exports.create = async (req, res) => {
  try {
    const data = req.body;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "Admin";

    // Gắn thêm author & createdBy
    const news = new News({
      ...data,
      author: { type: "admin", id: adminId },
      createdBy: { _id: adminId, time: new Date() },
    });

    await news.save();

    console.log("✅ News created:", news.title);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId,
        adminName,
        action: "create",
        model: "News",
        recordIds: [news._id],
        description: `Tạo bài viết: ${news.title}`,
        details: {
          newsId: news._id,
          newsTitle: news.title,
          newsSlug: news.slug,
          status: news.status,
          categoryId: news.newsCategoryId || news.categoryId,
          publishedAt: news.publishedAt,
          featured: news.featured,
          tags: news.tags,
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION
    try {
      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "news-management",
        title: "Bài viết mới được tạo",
        message: `${adminName} đã tạo bài viết: ${news.title}`,
        data: {
          newsId: news._id,
          newsTitle: news.title,
          newsSlug: news.slug,
          status: news.status,
          createdBy: adminName,
          createdAt: news.createdAt,
          isPublished: news.status === "published",
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Tạo bài viết thành công",
      data: news,
    });
  } catch (error) {
    console.error("❌ Error in createNews:", error);
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
      dateFrom = "",
      dateTo = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build match stage
    let matchStage = { deleted: false };

    // Apply filters
    if (status) matchStage.status = status;
    if (authorType) matchStage["author.type"] = authorType;
    if (authorId)
      matchStage["author.id"] = new mongoose.Types.ObjectId(authorId);
    if (type) matchStage.type = type;
    if (language) matchStage.language = language;

    // Enhanced category filtering with hierarchy support
    if (newsCategoryId) {
      try {
        // Get all descendant category IDs
        const descendantIds = await getAllDescendantIds(
          NewsCategory,
          newsCategoryId,
          "parentId"
        );

        // Include the selected category itself and all its descendants
        const allCategoryIds = [
          new mongoose.Types.ObjectId(newsCategoryId),
          ...descendantIds.map((id) => new mongoose.Types.ObjectId(id)),
        ];

        matchStage.newsCategoryId = { $in: allCategoryIds };
      } catch (error) {
        console.error("Error getting descendant categories:", error);
        // Fallback to exact match if hierarchy lookup fails
        matchStage.newsCategoryId = new mongoose.Types.ObjectId(newsCategoryId);
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      if (dateFrom) {
        matchStage.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        matchStage.createdAt.$lt = endDate;
      }
    }

    // Search stage - will be added conditionally
    let searchStage = null;
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      // Get author IDs that match search
      const [adminAuthors, userAuthors] = await Promise.all([
        AdminAccount.find({ fullName: searchRegex, deleted: false })
          .select("_id")
          .lean(),
        User.find({ fullName: searchRegex, deleted: false })
          .select("_id")
          .lean(),
      ]);

      const adminAuthorIds = adminAuthors.map((author) => author._id);
      const userAuthorIds = userAuthors.map((author) => author._id);

      searchStage = {
        $match: {
          $or: [
            { title: searchRegex },
            { excerpt: searchRegex },
            { content: searchRegex },
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
          ],
        },
      };
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      ...(searchStage ? [searchStage] : []),

      // Lookup news category with full hierarchy path
      {
        $lookup: {
          from: "news-category",
          localField: "newsCategoryId",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $addFields: {
          categoryInfo: { $arrayElemAt: ["$categoryInfo", 0] },
        },
      },

      // Lookup comments and count them
      {
        $lookup: {
          from: "comment",
          let: { newsId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$targetId", "$$newsId"] },
                    { $eq: ["$targetType", "news"] },
                    { $eq: ["$status", "approved"] },
                  ],
                },
              },
            },
          ],
          as: "comments",
        },
      },
      {
        $addFields: {
          commentCount: { $size: "$comments" },
        },
      },

      // Remove comments array (we only need the count)
      {
        $project: {
          comments: 0,
        },
      },

      // Sort
      {
        $sort: {
          [sortBy]: sortOrder === "asc" ? 1 : -1,
        },
      },

      // Facet for pagination and total count
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNum }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await News.aggregate(pipeline);
    let newsData = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;

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

        return {
          ...news,
          authorInfo,
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
      filters: {
        page: pageNum,
        limit: limitNum,
        search,
        status,
        authorType,
        authorId,
        type,
        language,
        newsCategoryId,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Error in getNewsList:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tin tức",
    });
  }
};

// Alternative method for getting category hierarchy path (optional)
const getCategoryPath = async (categoryId) => {
  const path = [];
  let currentId = categoryId;

  while (currentId) {
    const category = await NewsCategory.findById(currentId)
      .select("title parentId")
      .lean();

    if (!category) break;

    path.unshift({
      _id: category._id,
      title: category.title,
    });

    currentId = category.parentId;
  }

  return path;
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
    const adminId = req.admin?._id || req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "Admin";

    const news = await News.findOne({ _id: id, deleted: false });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tức",
      });
    }

    // Lưu thông tin trước khi xóa
    const newsInfo = {
      id: news._id,
      title: news.title,
      slug: news.slug,
      status: news.status,
      categoryId: news.newsCategoryId || news.categoryId,
      publishedAt: news.publishedAt,
    };

    // Soft delete
    await News.findByIdAndUpdate(id, {
      deleted: true,
      deletedAt: new Date(),
      deletedBy: {
        _id: adminId,
        time: new Date(),
      },
    });

    console.log("✅ News soft deleted:", newsInfo.title);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId,
        adminName,
        action: "delete",
        model: "News",
        recordIds: [newsInfo.id],
        description: `Xóa bài viết: ${newsInfo.title}`,
        details: {
          newsId: newsInfo.id,
          newsTitle: newsInfo.title,
          newsSlug: newsInfo.slug,
          previousStatus: newsInfo.status,
          wasPublished: newsInfo.status === "published",
          publishedAt: newsInfo.publishedAt,
          deletedAt: new Date(),
          deletionType: "soft_delete",
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION
    try {
      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "news-management",
        title: "Bài viết đã bị xóa",
        message: `${adminName} đã xóa bài viết: ${newsInfo.title}`,
        data: {
          newsId: newsInfo.id,
          newsTitle: newsInfo.title,
          newsSlug: newsInfo.slug,
          previousStatus: newsInfo.status,
          deletedBy: adminName,
          deletedAt: new Date().toISOString(),
          canRestore: true,
          wasPublished: newsInfo.status === "published", // Quan trọng nếu bài đã publish
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Delete notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Xóa tin tức thành công",
    });
  } catch (error) {
    console.error("❌ Error in deleteNews:", error);
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

// GET /api/admin/authors - Lấy danh sách tác giả có bài viết
module.exports.getAuthors = async (req, res) => {
  try {
    // Cách 1: Sử dụng aggregation (hiệu quả hơn cho dataset lớn)
    const newsAuthors = await News.aggregate([
      {
        $match: {
          deleted: false,
          status: { $ne: "archived" },
        },
      },
      {
        $group: {
          _id: {
            type: "$author.type",
            id: "$author.id",
          },
        },
      },
    ]);

    // Tách ra admin IDs và user IDs
    const adminIds = newsAuthors
      .filter((author) => author._id.type === "admin")
      .map((author) => author._id.id);

    const userIds = newsAuthors
      .filter((author) => author._id.type === "user")
      .map((author) => author._id.id);

    // Lấy thông tin chi tiết của admin và user có bài viết
    const [adminAuthors, userAuthors] = await Promise.all([
      AdminAccount.find({
        _id: { $in: adminIds },
        deleted: false,
        status: "active",
      })
        .select("fullName email avatar")
        .sort({ fullName: 1 })
        .lean(),

      User.find({
        _id: { $in: userIds },
        deleted: false,
        status: { $ne: "banned" },
      })
        .select("fullName email avatar")
        .sort({ fullName: 1 })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tác giả có bài viết thành công",
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
//  Phục vụ chức năng chỉnh sửa tin tức
// GET /api/v1/admin/news/:id - Lấy thông tin chi tiết news để edit
module.exports.getNewsForEdit = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "ID tin tức không hợp lệ",
      });
    }

    // Find news with all related data populated
    const news = await News.findById(id)
      .populate("newsCategoryId", "title slug _id parentId")
      .populate("categoryId", "title slug _id parentId")
      .populate("destinationIds", "name name_with_type code _id type")
      .populate("relatedTourIds", "title slug thumbnail price _id status")
      .lean();

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tức",
      });
    }

    if (news.deleted) {
      return res.status(404).json({
        success: false,
        message: "Tin tức đã bị xóa",
      });
    }

    // Get author information
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

    // Format data for frontend
    const formattedNews = {
      ...news,
      // Convert dates to format suitable for datetime-local input
      publishedAt: news.publishedAt
        ? new Date(news.publishedAt).toISOString().slice(0, 16)
        : "",
      eventDate: news.eventDate
        ? new Date(news.eventDate).toISOString().slice(0, 16)
        : "",

      // Ensure arrays are always arrays
      tags: news.tags || [],
      highlightImages: news.highlightImages || [],
      metaKeywords: news.metaKeywords || [],

      // Format related data
      destinationIds: news.destinationIds || [],
      relatedTourIds: news.relatedTourIds || [],

      // Add author info
      authorInfo,

      // Ensure required fields have default values
      title: news.title || "",
      slug: news.slug || "",
      content: news.content || "",
      excerpt: news.excerpt || "",
      thumbnail: news.thumbnail || "",
      metaTitle: news.metaTitle || "",
      metaDescription: news.metaDescription || "",
      type: news.type || "news",
      status: news.status || "draft",
      language: news.language || "vi",
    };

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin tin tức thành công",
      data: formattedNews,
    });
  } catch (error) {
    console.error("Error in getNewsForEdit:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin tin tức",
    });
  }
};

// PATCH /api/v1/admin/news/:id - Cập nhật tin tức
module.exports.updateNews = async (req, res) => {
  try {
    console.log("📝 updateNews called - Admin ID:", req.user?.id);

    const { id } = req.params;
    const updateData = req.body;
    const adminId = req.user?.id || req.admin?.adminId;
    const adminName =
      req.user?.fullName || req.admin?.fullName || req.admin?.email || "Admin";

    // Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "ID tin tức không hợp lệ",
      });
    }

    // Check if news exists and not deleted
    const existingNews = await News.findById(id).lean();
    if (!existingNews || existingNews.deleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tức hoặc tin tức đã bị xóa",
      });
    }

    // Lưu old data để track changes
    const oldData = {
      title: existingNews.title,
      slug: existingNews.slug,
      status: existingNews.status,
      featured: existingNews.featured,
      publishedAt: existingNews.publishedAt,
      categoryId: existingNews.newsCategoryId || existingNews.categoryId,
    };

    // Check slug uniqueness (exclude current news)
    if (updateData.slug && updateData.slug !== existingNews.slug) {
      const slugExists = await News.findOne({
        slug: updateData.slug,
        _id: { $ne: id },
        deleted: false,
      });

      if (slugExists) {
        return res.status(400).json({
          success: false,
          message: "Slug đã tồn tại, vui lòng chọn slug khác",
        });
      }
    }

    // Prepare update data
    const processedData = {
      ...updateData,
      publishedAt: updateData.publishedAt
        ? new Date(updateData.publishedAt)
        : null,
      eventDate: updateData.eventDate ? new Date(updateData.eventDate) : null,
      tags: Array.isArray(updateData.tags)
        ? updateData.tags.filter((tag) => tag && tag.trim())
        : [],
      highlightImages: Array.isArray(updateData.highlightImages)
        ? updateData.highlightImages.filter((img) => img && img.trim())
        : [],
      metaKeywords: Array.isArray(updateData.metaKeywords)
        ? updateData.metaKeywords.filter((keyword) => keyword && keyword.trim())
        : [],
      newsCategoryId: updateData.newsCategoryId || null,
      categoryId: updateData.categoryId || null,
      destinationIds: Array.isArray(updateData.destinationIds)
        ? updateData.destinationIds.filter((id) => id)
        : [],
      relatedTourIds: Array.isArray(updateData.relatedTourIds)
        ? updateData.relatedTourIds.filter((id) => id)
        : [],
      updatedBy: {
        _id: adminId,
        time: new Date(),
      },
    };

    // Remove undefined fields
    Object.keys(processedData).forEach((key) => {
      if (processedData[key] === undefined) {
        delete processedData[key];
      }
    });

    // Update the news
    const updatedNews = await News.findByIdAndUpdate(id, processedData, {
      new: true,
      runValidators: true,
    })
      .populate("newsCategoryId", "title slug")
      .populate("categoryId", "title slug")
      .populate("destinationIds", "name name_with_type code")
      .populate("relatedTourIds", "title slug thumbnail")
      .lean();

    console.log("✅ News updated:", updatedNews.title);

    // Track changes
    const changes = {};
    const changedFields = [];

    if (oldData.title !== updatedNews.title) {
      changes.title = { from: oldData.title, to: updatedNews.title };
      changedFields.push("title");
    }
    if (oldData.slug !== updatedNews.slug) {
      changes.slug = { from: oldData.slug, to: updatedNews.slug };
      changedFields.push("slug");
    }
    if (oldData.status !== updatedNews.status) {
      changes.status = { from: oldData.status, to: updatedNews.status };
      changedFields.push("status");
    }
    if (oldData.featured !== updatedNews.featured) {
      changes.featured = { from: oldData.featured, to: updatedNews.featured };
      changedFields.push("featured");
    }

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId,
        adminName,
        action: "update",
        model: "News",
        recordIds: [updatedNews._id],
        description: `Cập nhật bài viết: ${updatedNews.title}`,
        details: {
          newsId: updatedNews._id,
          newsTitle: updatedNews.title,
          newsSlug: updatedNews.slug,
          changedFields,
          changes,
          oldTitle:
            oldData.title !== updatedNews.title ? oldData.title : undefined,
          currentStatus: updatedNews.status,
          updatedFields: Object.keys(updateData),
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION
    try {
      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "news-management",
        title: "Bài viết đã được cập nhật",
        message: `${adminName} đã cập nhật bài viết: ${updatedNews.title}`,
        data: {
          newsId: updatedNews._id,
          newsTitle: updatedNews.title,
          newsSlug: updatedNews.slug,
          updatedBy: adminName,
          updatedAt: new Date().toISOString(),
          changedFields,
          oldTitle:
            oldData.title !== updatedNews.title ? oldData.title : undefined,
          hasImportantChanges: changedFields.some((field) =>
            ["status", "featured", "publishedAt"].includes(field)
          ),
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật tin tức thành công",
      data: updatedNews,
    });
  } catch (error) {
    console.error("❌ Error in updateNews:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: validationErrors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Slug đã tồn tại, vui lòng chọn slug khác",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật tin tức",
    });
  }
};
// GET /api/v1/admin/news/check-slug/:id - Kiểm tra slug có trùng không
module.exports.checkSlugAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Slug không được để trống",
      });
    }

    const existingNews = await News.findOne({
      slug: slug.trim(),
      _id: { $ne: id },
      deleted: false,
    }).lean();

    return res.status(200).json({
      success: true,
      available: !existingNews,
      message: existingNews ? "Slug đã được sử dụng" : "Slug có thể sử dụng",
    });
  } catch (error) {
    console.error("Error in checkSlugAvailability:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi kiểm tra slug",
    });
  }
};
//  Controller phục vụ cho trang chi tiết của News

// [GET] /admin/news/detail/:id - Lấy chi tiết bài viết
module.exports.getNewsDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await News.findById(id)
      .populate("newsCategoryId", "title slug")
      .populate("categoryId", "title slug")
      .populate("destinationIds", "name slug name_with_type")
      .populate("relatedTourIds", "title slug thumbnail prices discount seats")
      .populate("createdBy._id", "fullName email avatar")
      .populate("updatedBy._id", "fullName email avatar")
      .populate("deletedBy._id", "fullName email avatar")
      .lean();

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    // Lấy thông tin tác giả dựa vào type
    let authorInfo = null;
    if (news.author && news.author.id) {
      if (news.author.type === "admin") {
        authorInfo = await AdminAccount.findById(news.author.id)
          .select("fullName email avatar phone")
          .lean();
      } else if (news.author.type === "user") {
        authorInfo = await User.findById(news.author.id)
          .select("fullName email avatar phone")
          .lean();
      }
    }

    // Format dữ liệu trả về
    const responseData = {
      ...news,
      authorInfo: authorInfo
        ? {
            ...authorInfo,
            type: news.author.type,
          }
        : null,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching news detail:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết bài viết",
      error: error.message,
    });
  }
};

// [PUT] /admin/news/status/:id - Cập nhật trạng thái bài viết
module.exports.updateNewsStatus = async (req, res) => {
  try {
    console.log("🔄 updateNewsStatus called - User ID:", req.user?.id);

    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user?.id || req.admin?.adminId;
    const adminName =
      req.user?.fullName || req.admin?.fullName || req.admin?.email || "Admin";

    if (!["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    // Lấy thông tin cũ
    const oldNews = await News.findById(id).lean();
    if (!oldNews) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    const oldStatus = oldNews.status;

    const updateData = {
      status,
      "updatedBy._id": adminId,
      "updatedBy.time": new Date(),
    };

    // Nếu publish thì set publishedAt
    if (status === "published") {
      updateData.publishedAt = new Date();
    }

    const updatedNews = await News.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    console.log(`✅ News status updated: ${oldStatus} → ${status}`);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId,
        adminName,
        action: "update",
        model: "News",
        recordIds: [updatedNews._id],
        description: `Thay đổi trạng thái bài viết: ${updatedNews.title} (${oldStatus} → ${status})`,
        details: {
          newsId: updatedNews._id,
          newsTitle: updatedNews.title,
          statusChange: {
            from: oldStatus,
            to: status,
          },
          publishedAt: updatedNews.publishedAt,
          updateType: "status_change",
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION (Đặc biệt quan trọng cho status change)
    try {
      const statusMessages = {
        published: "đã xuất bản",
        draft: "đã chuyển về nháp",
        archived: "đã lưu trữ",
      };

      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "news-management",
        title: `Bài viết ${statusMessages[status]}`,
        message: `${adminName} đã ${statusMessages[status]} bài viết: ${updatedNews.title}`,
        data: {
          newsId: updatedNews._id,
          newsTitle: updatedNews.title,
          statusChange: {
            from: oldStatus,
            to: status,
          },
          updatedBy: adminName,
          updatedAt: new Date().toISOString(),
          publishedAt: updatedNews.publishedAt,
          isPublished: status === "published",
          isImportant: true, // Status change là quan trọng
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Status change notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: {
        id: updatedNews._id,
        status: updatedNews.status,
        publishedAt: updatedNews.publishedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating news status:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái",
      error: error.message,
    });
  }
};

// [PUT] /admin/news/:id/engagement - Cập nhật tương tác (views, likes, saves, shares)
module.exports.updateEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'view', 'like', 'save', 'share'

    if (!["view", "like", "save", "share"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Loại tương tác không hợp lệ",
      });
    }

    const updateField = {};
    updateField[type + "s"] = 1;

    const updatedNews = await News.findByIdAndUpdate(
      id,
      { $inc: updateField },
      { new: true }
    ).select("views likes saves shares");

    if (!updatedNews) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    res.json({
      success: true,
      message: `Cập nhật ${type} thành công`,
      data: {
        views: updatedNews.views,
        likes: updatedNews.likes,
        saves: updatedNews.saves,
        shares: updatedNews.shares,
      },
    });
  } catch (error) {
    console.error("Error updating engagement:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật tương tác",
      error: error.message,
    });
  }
};
