const TourCategory = require("../../models/tour-category.model");
// [GET] /api/v1/get-tour-category-by-slug
exports.getTourCategoryBySlug = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const categoryDoc = await TourCategory.findOne({ slug: categorySlug });
    res.json({
      success: true,
      message: "Lấy danh mục thành công",
      data: categoryDoc,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh mục", error: error.message });
  }
};
