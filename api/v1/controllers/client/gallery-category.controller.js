const GalleryCategory = require("../../models/gallery-category.model");
const buildTree = require("../../../../helpers/buildTree");

// [GET] /api/v1/gallery-category/all?tree=true
// Dùng cho: GalleryCategoryTreeSelect component
module.exports.getAllCategories = async (req, res) => {
  try {
    const { tree } = req.query;

    // Chỉ lấy categories active và chưa xóa
    const filter = {
      deleted: false,
      active: true,
    };

    const categories = await GalleryCategory.find(filter)
      .select("_id title slug parent position")
      .sort({ position: 1, title: 1 });

    // Nếu query có ?tree=true thì trả về dạng cây
    if (tree === "true") {
      return res.json({
        success: true,
        data: buildTree(categories),
      });
    }

    // Ngược lại trả về flat list
    return res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh mục gallery",
      error: error.message,
    });
  }
};

// [GET] /api/v1/gallery-category/by-slug/:slug
// Dùng cho: Khởi tạo filter khi vào GalleryPage theo slug
module.exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await GalleryCategory.findOne({
      slug: slug,
      deleted: false,
      active: true,
    })
      .select("_id title slug description")
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error getting category by slug:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
