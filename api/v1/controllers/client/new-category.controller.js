const NewsCategory = require("../../models/new-category.model");
// [GET] /api/v1/get-news-category-by-slug
exports.getNewsCategoryBySlug = async (req, res) => {
  try {
    const { newsCategorySlug } = req.params;
    const categoryDoc = await NewsCategory.findOne({ slug: newsCategorySlug });
    res.json({
      success: true,
      message: "Lấy danh mục thành công",
      data: categoryDoc,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh mục", error: error.message });
  }
};
