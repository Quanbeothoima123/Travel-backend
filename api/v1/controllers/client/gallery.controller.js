const Gallery = require("../../models/gallery.model");
const GalleryCategory = require("../../models/gallery-category.model");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");

// [GET] /api/v1/gallery/by-category/:categorySlug?keyword=...&sortBy=...&page=...
module.exports.getGalleriesByCategory = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const {
      keyword = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 12,
    } = req.query;

    // 1. Tìm category theo slug
    const category = await GalleryCategory.findOne({
      slug: categorySlug,
      deleted: false,
      active: true,
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    // 2. Lấy tất cả ID con cháu
    const descendantIds = await getAllDescendantIds(
      GalleryCategory,
      category._id,
      "parentId"
    );
    const allCategoryIds = [category._id, ...descendantIds];

    // 3. Build filter
    const filter = {
      deleted: false,
      active: true,
      galleryCategory: { $in: allCategoryIds },
    };

    // Tìm kiếm theo keyword
    if (keyword.trim()) {
      filter.title = { $regex: keyword.trim(), $options: "i" };
    }

    // 4. Sorting
    const sortOptions = {};
    const validSortFields = ["createdAt", "views", "likes", "shares", "title"];
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }

    // 5. Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;

    const totalItems = await Gallery.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNum);

    // 6. Get galleries
    const galleries = await Gallery.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .select(
        "title thumbnail shortDescription views likes shares createdAt galleryCategory slug"
      )
      .populate("galleryCategory", "title slug")
      .lean();

    return res.status(200).json({
      success: true,
      data: galleries,
      category: {
        _id: category._id,
        title: category.title,
        slug: category.slug,
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching galleries by category:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// [GET] /api/v1/gallery/all?keyword=...&galleryCategory=...
// Dùng khi KHÔNG có categorySlug (hiển thị tất cả)
module.exports.getAllGalleries = async (req, res) => {
  try {
    const {
      keyword = "",
      galleryCategory = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 12,
    } = req.query;

    // Build filter
    const filter = {
      deleted: false,
      active: true,
    };

    // Keyword
    if (keyword.trim()) {
      filter.title = { $regex: keyword.trim(), $options: "i" };
    }

    // Filter by galleryCategory (bao gồm con cháu)
    if (galleryCategory) {
      const descendantIds = await getAllDescendantIds(
        GalleryCategory,
        galleryCategory,
        "parentId"
      );
      const allCategoryIds = [galleryCategory, ...descendantIds];
      filter.galleryCategory = { $in: allCategoryIds };
    }

    // Sorting
    const sortOptions = {};
    const validSortFields = ["createdAt", "views", "likes", "shares", "title"];
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;

    const totalItems = await Gallery.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Get galleries
    const galleries = await Gallery.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .select(
        "title thumbnail shortDescription views likes shares createdAt galleryCategory slug"
      )
      .populate("galleryCategory", "title slug")
      .lean();

    return res.status(200).json({
      success: true,
      data: galleries,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching all galleries:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// [GET] /api/v1/gallery/detail/:slug
module.exports.getGalleryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    let gallery = await Gallery.findOne({
      slug: slug,
      deleted: false,
      active: true,
    })
      .populate("tour", "title slug thumbnail")
      .populate("tourCategory", "title slug")
      .populate("galleryCategory", "title slug")
      .lean();

    // Nếu tìm thấy gallery -> trả về detail
    if (gallery) {
      return res.status(200).json({
        success: true,
        data: gallery,
      });
    }

    // Nếu không tìm thấy gallery, check xem có phải category slug không
    const category = await GalleryCategory.findOne({
      slug: slug,
      deleted: false,
      active: true,
    }).lean();

    if (category) {
      // Đây là category slug, gọi hàm getGalleriesByCategory
      req.params.categorySlug = slug;
      return module.exports.getGalleriesByCategory(req, res);
    }

    // Không tìm thấy cả gallery và category
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy gallery",
    });
  } catch (error) {
    console.error("Error getting gallery by slug:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin gallery",
      error: error.message,
    });
  }
};

// [POST] /api/v1/gallery/view/:id
module.exports.incrementView = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOneAndUpdate(
      { _id: id, deleted: false, active: true },
      { $inc: { views: 1 } },
      { new: true }
    ).select("views");

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    return res.status(200).json({
      success: true,
      views: gallery.views,
    });
  } catch (error) {
    console.error("Error incrementing view:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tăng lượt xem",
      error: error.message,
    });
  }
};

// [POST] /api/v1/gallery/like/:id
module.exports.incrementLike = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOneAndUpdate(
      { _id: id, deleted: false, active: true },
      { $inc: { likes: 1 } },
      { new: true }
    ).select("likes");

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    return res.status(200).json({
      success: true,
      likes: gallery.likes,
    });
  } catch (error) {
    console.error("Error incrementing like:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tăng lượt thích",
      error: error.message,
    });
  }
};

// [POST] /api/v1/gallery/share/:id
module.exports.incrementShare = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOneAndUpdate(
      { _id: id, deleted: false, active: true },
      { $inc: { shares: 1 } },
      { new: true }
    ).select("shares");

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    return res.status(200).json({
      success: true,
      shares: gallery.shares,
    });
  } catch (error) {
    console.error("Error incrementing share:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tăng lượt chia sẻ",
      error: error.message,
    });
  }
};

// [GET] /api/v1/gallery/related/:id
module.exports.getRelatedGalleries = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 6 } = req.query;

    // Lấy thông tin gallery hiện tại
    const currentGallery = await Gallery.findOne({
      _id: id,
      deleted: false,
      active: true,
    }).select("galleryCategory tour tags");

    if (!currentGallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    // Tìm galleries liên quan
    const filter = {
      _id: { $ne: id }, // Loại trừ gallery hiện tại
      deleted: false,
      active: true,
      $or: [
        { galleryCategory: currentGallery.galleryCategory },
        { tour: currentGallery.tour },
        { tags: { $in: currentGallery.tags || [] } },
      ],
    };

    const relatedGalleries = await Gallery.find(filter)
      .limit(parseInt(limit))
      .sort({ views: -1 }) // Ưu tiên galleries có nhiều views
      .populate("galleryCategory", "title slug")
      .select("title shortDescription thumbnail views likes shares slug")
      .lean();

    return res.status(200).json({
      success: true,
      data: relatedGalleries,
    });
  } catch (error) {
    console.error("Error getting related galleries:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy galleries liên quan",
      error: error.message,
    });
  }
};

// [GET] /api/v1/gallery/popular
module.exports.getPopularGalleries = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const galleries = await Gallery.find({
      deleted: false,
      active: true,
    })
      .sort({ views: -1, likes: -1 }) // Sắp xếp theo views và likes
      .limit(parseInt(limit))
      .populate("galleryCategory", "title slug")
      .select("title shortDescription thumbnail views likes shares slug")
      .lean();

    return res.status(200).json({
      success: true,
      data: galleries,
    });
  } catch (error) {
    console.error("Error getting popular galleries:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy galleries phổ biến",
      error: error.message,
    });
  }
};

// [GET] /api/v1/gallery/latest
module.exports.getLatestGalleries = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const galleries = await Gallery.find({
      deleted: false,
      active: true,
    })
      .sort({ createdAt: -1 }) // Mới nhất
      .limit(parseInt(limit))
      .populate("galleryCategory", "title slug")
      .select(
        "title shortDescription thumbnail views likes shares slug createdAt"
      )
      .lean();

    return res.status(200).json({
      success: true,
      data: galleries,
    });
  } catch (error) {
    console.error("Error getting latest galleries:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy galleries mới nhất",
      error: error.message,
    });
  }
};
