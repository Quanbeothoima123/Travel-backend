const Gallery = require("../../models/gallery.model");
const Tour = require("../../models/tour.model");
const TourCategory = require("../../models/tour-category.model");
const GalleryCategory = require("../../models/gallery-category.model");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");
// [POST] /api/v1/admin/gallery/create/:id
module.exports.createGallery = async (req, res) => {
  try {
    const {
      title,
      shortDescription,
      longDescription,
      thumbnail,
      images,
      videos,
      tags,
      tour,
      tourCategory,
      galleryCategory, // THÊM MỚI
    } = req.body;

    console.log("Request body:", req.body);

    // Validate required fields
    if (!title || !thumbnail) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (title, thumbnail)",
      });
    }

    // THÊM VALIDATION CHO galleryCategory (BẮT BUỘC)
    if (!galleryCategory) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn danh mục Gallery",
      });
    }

    // Kiểm tra ít nhất có ảnh hoặc video
    if ((!images || images.length === 0) && (!videos || videos.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Cần có ít nhất một ảnh hoặc video",
      });
    }

    const mongoose = require("mongoose");

    // Xử lý galleryCategory (BẮT BUỘC)
    let galleryCategoryId = null;
    if (mongoose.Types.ObjectId.isValid(galleryCategory)) {
      const galleryCategoryDoc = await GalleryCategory.findOne({
        _id: galleryCategory,
        deleted: false,
      });

      if (galleryCategoryDoc) {
        galleryCategoryId = galleryCategoryDoc._id;
        console.log("Found galleryCategory:", galleryCategoryDoc.title);
      } else {
        return res.status(400).json({
          success: false,
          message: "Danh mục Gallery không tồn tại hoặc đã bị xóa",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "ID danh mục Gallery không hợp lệ",
      });
    }

    // Tìm tour bằng _id (nếu có)
    let tourId = null;
    if (tour) {
      if (mongoose.Types.ObjectId.isValid(tour)) {
        const tourDoc = await Tour.findOne({ _id: tour, deleted: false });
        if (tourDoc) {
          tourId = tourDoc._id;
          console.log("Found tour:", tourDoc.title);
        } else {
          console.log("Tour not found with _id:", tour);
        }
      } else {
        console.log("Invalid tour _id:", tour);
      }
    }

    // Kiểm tra và lấy tourCategory bằng _id (nếu có)
    let tourCategoryId = null;
    if (tourCategory) {
      if (mongoose.Types.ObjectId.isValid(tourCategory)) {
        const tourCategoryDoc = await TourCategory.findOne({
          _id: tourCategory,
          deleted: false,
        });
        if (tourCategoryDoc) {
          tourCategoryId = tourCategoryDoc._id;
          console.log("Found tourCategory:", tourCategoryDoc.title);
        } else {
          console.log("TourCategory not found with _id:", tourCategory);
        }
      } else {
        console.log("Invalid tourCategory _id:", tourCategory);
      }
    }

    // Xử lý images
    const processedImages = images
      ? images
          .filter((img) => img.url)
          .map((img) => ({
            url: img.url,
            title: img.title?.trim() || undefined,
          }))
      : [];

    // Xử lý videos
    const processedVideos = videos
      ? videos
          .filter((vid) => vid.url)
          .map((vid) => ({
            url: vid.url,
            title: vid.title?.trim() || undefined,
          }))
      : [];

    // Tạo gallery mới
    const galleryData = {
      title: title.trim(),
      shortDescription: shortDescription?.trim() || undefined,
      longDescription: longDescription?.trim() || undefined,
      thumbnail,
      images: processedImages,
      videos: processedVideos,
      tags: tags || [],
      galleryCategory: galleryCategoryId, // BẮT BUỘC
      createdBy: {
        _id: req.admin?.id || req.user?._id,
        time: new Date(),
      },
      views: 0,
      likes: 0,
      shares: 0,
      deleted: false,
    };

    // Chỉ thêm tour và tourCategory nếu có
    if (tourId) {
      galleryData.tour = tourId;
    }
    if (tourCategoryId) {
      galleryData.tourCategory = tourCategoryId;
    }

    const newGallery = new Gallery(galleryData);
    await newGallery.save();

    return res.status(201).json({
      success: true,
      message: "Tạo gallery thành công",
    });
  } catch (error) {
    console.error("Error creating gallery:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo gallery",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/gallery/generate-tags
module.exports.generateTags = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({
        success: false,
        message: "Cần có tiêu đề hoặc mô tả để tạo tags",
      });
    }

    // Giả lập AI tạo tags dựa trên title và description
    // Trong thực tế, bạn có thể tích hợp với OpenAI hoặc dịch vụ AI khác
    const text = `${title || ""} ${description || ""}`.toLowerCase();
    const suggestedTags = [];

    // Từ khóa liên quan đến du lịch
    const keywords = {
      biển: ["biển", "beach", "bãi biển", "du lịch biển"],
      núi: ["núi", "mountain", "leo núi", "trekking"],
      "thành phố": ["thành phố", "city", "đô thị", "city tour"],
      "văn hóa": ["văn hóa", "culture", "lịch sử", "heritage"],
      "ẩm thực": ["ẩm thực", "food", "đặc sản", "món ăn"],
      "phiêu lưu": ["phiêu lưu", "adventure", "mạo hiểm"],
      "nghỉ dưỡng": ["nghỉ dưỡng", "resort", "thư giãn", "relax"],
      "thiên nhiên": ["thiên nhiên", "nature", "eco", "xanh"],
      "lễ hội": ["lễ hội", "festival", "sự kiện", "event"],
      "gia đình": ["gia đình", "family", "trẻ em", "kids"],
      "cặp đôi": ["cặp đôi", "couple", "honeymoon", "romantic"],
      "khám phá": ["khám phá", "explore", "discovery"],
      "truyền thống": ["truyền thống", "traditional", "làng nghề"],
      "miền bắc": ["miền bắc", "hà nội", "hạ long", "sapa"],
      "miền trung": ["miền trung", "huế", "đà nẵng", "hội an"],
      "miền nam": ["miền nam", "sài gòn", "mekong", "phú quốc"],
    };

    // Tìm tags phù hợp
    for (const [tag, patterns] of Object.entries(keywords)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          suggestedTags.push(tag);
          break;
        }
      }
    }

    // Thêm một số tags chung
    const commonTags = ["du lịch", "việt nam", "travel"];
    const randomCommon =
      commonTags[Math.floor(Math.random() * commonTags.length)];
    if (!suggestedTags.includes(randomCommon)) {
      suggestedTags.push(randomCommon);
    }

    // Đảm bảo có ít nhất 3 tags
    if (suggestedTags.length === 0) {
      suggestedTags.push("du lịch", "khám phá", "việt nam");
    }

    return res.status(200).json({
      success: true,
      tags: [...new Set(suggestedTags)], // Remove duplicates
    });
  } catch (error) {
    console.error("Error generating tags:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo tags",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/gallery/getAll
module.exports.getAllGalleries = async (req, res) => {
  try {
    const { page = 1, limit = 20, tourCategory, tour, search } = req.query;

    const filter = { deleted: false };

    if (tourCategory) {
      const tourCategoryDoc = await TourCategory.findOne({
        slug: tourCategory,
      });
      if (tourCategoryDoc) {
        filter.tourCategory = tourCategoryDoc._id;
      }
    }

    if (tour) {
      const tourDoc = await Tour.findOne({ slug: tour });
      if (tourDoc) {
        filter.tour = tourDoc._id;
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const skip = (page - 1) * limit;

    const galleries = await Gallery.find(filter)
      .populate("tour", "title slug")
      .populate("tourCategory", "title slug")
      .populate("createdBy._id", "username fullName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Gallery.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: galleries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting galleries:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách galleries",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/gallery/detail/:id
module.exports.getGalleryById = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOne({ _id: id, deleted: false })
      .populate("tour", "title slug thumbnail")
      .populate("tourCategory", "title slug")
      .populate("galleryCategory", "title slug")
      .populate("createdBy._id", "username fullName")
      .populate("updatedBy._id", "username fullName");

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }
    return res.status(200).json({
      success: true,
      data: gallery,
    });
  } catch (error) {
    console.error("Error getting gallery:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin gallery",
      error: error.message,
    });
  }
};
// [PATCH] /api/v1/admin/gallery/infoToEdit/:id
module.exports.getGalleryForEdit = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOne({ _id: id, deleted: false })
      .populate("tour", "title slug _id")
      .populate("tourCategory", "title slug _id")
      .populate("galleryCategory", "title slug _id") // ✅ THÊM populate galleryCategory
      .lean(); // Sử dụng lean() cho performance

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    return res.status(200).json({
      success: true,
      data: gallery,
    });
  } catch (error) {
    console.error("Error getting gallery for edit:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin gallery",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/gallery/update/:id
module.exports.updateGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      shortDescription,
      longDescription,
      thumbnail,
      images,
      videos,
      tags,
      tour,
      tourCategory,
      galleryCategory,
    } = req.body;

    // ✅ VALIDATION
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề không được để trống",
      });
    }

    if (!thumbnail) {
      return res.status(400).json({
        success: false,
        message: "Thumbnail không được để trống",
      });
    }

    if (!galleryCategory) {
      return res.status(400).json({
        success: false,
        message: "Danh mục Gallery không được để trống",
      });
    }

    // ✅ VALIDATION: Phải có ít nhất 1 trong 2 (images hoặc videos)
    const hasImages = images && Array.isArray(images) && images.length > 0;
    const hasVideos = videos && Array.isArray(videos) && videos.length > 0;

    if (!hasImages && !hasVideos) {
      return res.status(400).json({
        success: false,
        message: "Phải có ít nhất một ảnh hoặc video",
      });
    }

    const gallery = await Gallery.findOne({ _id: id, deleted: false });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    // Cập nhật thông tin bắt buộc
    gallery.title = title.trim();
    gallery.thumbnail = thumbnail;
    gallery.shortDescription = shortDescription?.trim() || "";
    gallery.longDescription = longDescription?.trim() || "";
    gallery.tags = tags || [];

    // ✅ Cập nhật galleryCategory (BẮT BUỘC)
    const galleryCategoryDoc = await GalleryCategory.findOne({
      _id: galleryCategory,
      deleted: false,
    });

    if (!galleryCategoryDoc) {
      return res.status(400).json({
        success: false,
        message: "Danh mục Gallery không hợp lệ",
      });
    }
    gallery.galleryCategory = galleryCategoryDoc._id;

    // ✅ Cập nhật tour (TÙY CHỌN)
    if (tour) {
      const tourDoc = await Tour.findOne({ _id: tour, deleted: false });
      if (tourDoc) {
        gallery.tour = tourDoc._id;
      } else {
        gallery.tour = null;
      }
    } else {
      gallery.tour = null;
    }

    // ✅ Cập nhật tourCategory (TÙY CHỌN)
    if (tourCategory) {
      const tourCategoryDoc = await TourCategory.findOne({
        _id: tourCategory,
        deleted: false,
      });
      if (tourCategoryDoc) {
        gallery.tourCategory = tourCategoryDoc._id;
      } else {
        gallery.tourCategory = null;
      }
    } else {
      gallery.tourCategory = null;
    }

    // ✅ Cập nhật images (có thể rỗng nếu có videos)
    gallery.images = hasImages
      ? images
          .filter((img) => img.url)
          .map((img) => ({
            url: img.url,
            title: img.title?.trim() || "",
          }))
      : [];

    // ✅ Cập nhật videos (có thể rỗng nếu có images)
    gallery.videos = hasVideos
      ? videos
          .filter((vid) => vid.url)
          .map((vid) => ({
            url: vid.url,
            title: vid.title?.trim() || "",
          }))
      : [];

    gallery.updatedBy = {
      _id: req.admin?.id || req.user?._id,
      time: new Date(),
    };

    await gallery.save();

    // Populate để trả về đầy đủ thông tin
    await gallery.populate([
      { path: "tour", select: "title slug _id" },
      { path: "tourCategory", select: "title slug _id" },
      { path: "galleryCategory", select: "title slug _id" },
    ]);

    return res.status(200).json({
      success: true,
      message: "Cập nhật gallery thành công",
      data: gallery,
    });
  } catch (error) {
    console.error("Error updating gallery:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật gallery",
      error: error.message,
    });
  }
};

// [DELETE] /api/v1/admin/gallery/delete/:id
module.exports.deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOne({ _id: id, deleted: false });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    gallery.deleted = true;
    gallery.deletedBy = {
      _id: req.admin?.id || req.user?._id,
      time: new Date(),
    };
    await gallery.save();

    return res.status(200).json({
      success: true,
      message: "Xóa gallery thành công",
    });
  } catch (error) {
    console.error("Error deleting gallery:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa gallery",
      error: error.message,
    });
  }
};

// [POST] /api/v1/admin/gallery/view/:id
module.exports.incrementView = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOneAndUpdate(
      { _id: id, deleted: false },
      { $inc: { views: 1 } },
      { new: true }
    );

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

// [POST] /api/v1/admin/gallery/like/:id
module.exports.incrementLike = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOneAndUpdate(
      { _id: id, deleted: false },
      { $inc: { likes: 1 } },
      { new: true }
    );

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

// [POST] /api/v1/admin/gallery/share/:id
module.exports.incrementShare = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await Gallery.findOneAndUpdate(
      { _id: id, deleted: false },
      { $inc: { shares: 1 } },
      { new: true }
    );

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

// [GET] /api/v1/admin/gallery/manager?querry
module.exports.index = async (req, res) => {
  try {
    const {
      keyword = "",
      tour = "",
      tourCategory = "",
      galleryCategory = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      mediaType = "all", // all, images, videos, both
      page = 1,
      limit = 10,
    } = req.query;

    // Build filter object
    const filter = { deleted: false };

    // Tìm kiếm theo tên (regex)
    if (keyword.trim()) {
      filter.title = { $regex: keyword.trim(), $options: "i" };
    }

    // Lọc theo tour
    if (tour) {
      filter.tour = tour;
    }

    // Lọc theo tourCategory (bao gồm cả con)
    if (tourCategory) {
      const descendantIds = await getAllDescendantIds(
        TourCategory,
        tourCategory,
        "parent"
      );
      const allCategoryIds = [tourCategory, ...descendantIds];
      filter.tourCategory = { $in: allCategoryIds };
    }

    // Lọc theo galleryCategory (bao gồm cả con)
    if (galleryCategory) {
      const descendantIds = await getAllDescendantIds(
        GalleryCategory,
        galleryCategory,
        "parent"
      );
      const allCategoryIds = [galleryCategory, ...descendantIds];
      filter.galleryCategory = { $in: allCategoryIds };
    }

    // Lọc theo loại media
    if (mediaType === "images") {
      filter.$expr = { $gt: [{ $size: "$images" }, 0] };
    } else if (mediaType === "videos") {
      filter.$expr = { $gt: [{ $size: "$videos" }, 0] };
    } else if (mediaType === "both") {
      filter.$and = [
        { $expr: { $gt: [{ $size: "$images" }, 0] } },
        { $expr: { $gt: [{ $size: "$videos" }, 0] } },
      ];
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
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const totalItems = await Gallery.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Get galleries
    const galleries = await Gallery.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate("tour", "title slug")
      .populate("tourCategory", "title slug")
      .populate("galleryCategory", "title slug")
      .populate("createdBy._id", "fullName email")
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
    console.error("Error fetching galleries:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách gallery",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/gallery/toggle-active/:id
module.exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const gallery = await Gallery.findById(id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gallery",
      });
    }

    gallery.active = !gallery.active;
    gallery.updatedBy = {
      _id: req.admin?.id || req.user?._id,
      time: new Date(),
    };
    await gallery.save();

    return res.status(200).json({
      success: true,
      message: `${
        gallery.active ? "Kích hoạt" : "Vô hiệu hóa"
      } gallery thành công`,
      active: gallery.active,
    });
  } catch (error) {
    console.error("Error toggling active:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
