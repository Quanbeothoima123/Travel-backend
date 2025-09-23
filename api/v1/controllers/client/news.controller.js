const jwt = require("jsonwebtoken");
const News = require("../../models/news.model");
const NewsCategory = require("../../models/new-category.model");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");
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

// Lấy danh sách news theo category.slug (bao gồm category con)
module.exports.newsListByCategory = async (req, res) => {
  try {
    const slug = req.params.slug;

    // tìm category gốc theo slug
    const rootCategory = await NewsCategory.findOne({ slug }).lean();
    if (!rootCategory) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tour có danh mục tin tức này" });
    }

    // lấy tất cả category con
    const childIds = await getAllDescendantIds(NewsCategory, rootCategory._id);
    const allCategoryIds = [
      rootCategory._id.toString(),
      ...childIds.map((id) => id.toString()),
    ];
    // query tour + populate
    const newsList = await News.find({
      newsCategoryId: { $in: allCategoryIds },
      status: "published",
      deleted: false,
    })
      .sort({ publishedAt: -1 })
      .select("_id title slug thumbnail excerpt publishedAt views")
      .lean();

    res.json(newsList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Advanced search for news
 * GET /api/v1/news/advanced-search/:newsCategorySlug
 */
module.exports.advancedSearchNews = async (req, res) => {
  try {
    const { newsCategorySlug } = req.params;
    const {
      q,
      type,
      language,
      eventDateFrom,
      eventDateTo,
      relatedTour,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    // Build search query
    const searchQuery = {
      status: "published",
      deleted: false,
    };

    // Text search
    if (q) {
      searchQuery.$or = [
        { title: { $regex: q, $options: "i" } },
        { excerpt: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    // News category filter
    if (newsCategorySlug && newsCategorySlug !== "all") {
      const newsCategory = await NewsCategory.findOne({
        slug: newsCategorySlug,
        deleted: false,
      });

      if (newsCategory) {
        // Get all child categories recursively
        const getAllChildCategories = async (categoryId) => {
          const children = await NewsCategory.find({
            parentId: categoryId,
            deleted: false,
          });

          let allIds = [categoryId];
          for (const child of children) {
            const childIds = await getAllChildCategories(child._id);
            allIds = allIds.concat(childIds);
          }
          return allIds;
        };

        const categoryIds = await getAllChildCategories(newsCategory._id);
        searchQuery.newsCategoryId = { $in: categoryIds };
      }
    }

    // Article type filter
    if (type) {
      searchQuery.type = type;
    }

    // Language filter
    if (language) {
      searchQuery.language = language;
    }
    // Related tour filter
    if (relatedTour) {
      searchQuery.relatedTourIds = { $in: [relatedTour] };
    }

    // Event date range filter
    if (eventDateFrom || eventDateTo) {
      searchQuery.eventDate = {};
      if (eventDateFrom) {
        searchQuery.eventDate.$gte = new Date(eventDateFrom);
      }
      if (eventDateTo) {
        searchQuery.eventDate.$lte = new Date(eventDateTo + "T23:59:59.999Z");
      }
    }

    // Sort options
    let sortOptions = {};
    switch (sort) {
      case "publishedAt-desc":
        sortOptions = { publishedAt: -1 };
        break;
      case "publishedAt-asc":
        sortOptions = { publishedAt: 1 };
        break;
      case "title-asc":
        sortOptions = { title: 1 };
        break;
      case "title-desc":
        sortOptions = { title: -1 };
        break;
      case "views-desc":
        sortOptions = { views: -1 };
        break;
      case "likes-desc":
        sortOptions = { likes: -1 };
        break;
      case "eventDate-desc":
        sortOptions = { eventDate: -1 };
        break;
      default:
        sortOptions = { publishedAt: -1, createdAt: -1 };
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;

    // Execute search with populate
    const [newsResults, total] = await Promise.all([
      News.find(searchQuery)
        .populate("newsCategoryId", "title slug")
        .populate("categoryId", "title slug")
        .populate("destinationIds", "name slug")
        .populate("relatedTourIds", "title slug thumbnail prices")
        .populate("author.id", "fullName email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      News.countDocuments(searchQuery),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Response
    res.status(200).json({
      success: true,
      data: newsResults,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
      },
      // For backward compatibility
      totalPages,
      currentPage: pageNum,
    });
  } catch (error) {
    console.error("Error in advancedSearchNews:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tìm kiếm tin tức",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
module.exports.detailNews = async (req, res) => {
  try {
    const { newsSlug } = req.params;
    const news = await News.findOne({ status: "published", slug: newsSlug })
      .populate("newsCategoryId", "title slug")
      .populate("categoryId", "title slug")
      .populate("destinationIds", "name slug")
      .populate("relatedTourIds", "title slug thumbnail");

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    const { createdBy, updatedBy, deletedBy, ...rest } = news.toObject();

    res.status(200).json({
      success: true,
      data: rest,
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Cập nhật view cho news
module.exports.updateNewsViews = async (req, res) => {
  try {
    const { newsId } = req.params;

    if (!newsId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu newsId",
      });
    }

    const news = await News.findByIdAndUpdate(
      newsId,
      { $inc: { views: 1 } }, // tăng view thêm 1
      { new: true } // trả về document mới sau khi update
    );

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật lượt xem thành công",
      data: {
        _id: news._id,
        views: news.views,
      },
    });
  } catch (error) {
    console.error("Error updating news views:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

/**
 * Get all unique tags from published news
 * GET /api/v1/news/tags
 */
const getAllTags = async (req, res) => {
  try {
    const tags = await News.aggregate([
      { $match: { status: "published", deleted: false } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $sort: { _id: 1 } },
      { $limit: 100 },
    ]);

    const tagsList = tags
      .map((tag) => tag._id)
      .filter((tag) => tag && tag.trim());

    res.status(200).json({
      success: true,
      data: tagsList,
    });
  } catch (error) {
    console.error("Error in getAllTags:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tags",
    });
  }
};

/**
 * Get news statistics
 * GET /api/v1/news/stats
 */
const getNewsStats = async (req, res) => {
  try {
    const stats = await News.aggregate([
      { $match: { deleted: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
          },
          draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          archived: {
            $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] },
          },
          totalViews: { $sum: "$views" },
          totalLikes: { $sum: "$likes" },
          totalFavorites: { $sum: "$favorites" },
        },
      },
    ]);

    const typeStats = await News.aggregate([
      { $match: { status: "published", deleted: false } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          total: 0,
          published: 0,
          draft: 0,
          archived: 0,
          totalViews: 0,
          totalLikes: 0,
          totalFavorites: 0,
        },
        byType: typeStats,
      },
    });
  } catch (error) {
    console.error("Error in getNewsStats:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thống kê tin tức",
    });
  }
};
