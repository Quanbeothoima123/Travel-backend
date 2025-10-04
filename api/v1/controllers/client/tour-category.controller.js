const TourCategory = require("../../models/tour-category.model");
const buildTree = require("../../../../helpers/buildTree");
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

// [GET] /tour-categories
module.exports.getAllCategories = async (req, res) => {
  try {
    const { tree } = req.query;
    const filter = { deleted: false, active: true };
    const categories = await TourCategory.find(filter).sort({ createdAt: -1 });
    if (tree === "true") {
      return res.json(buildTree(categories));
    }
    return res.json(categories);
  } catch (error) {
    console.error("getAllCategories error:", error);
    res.status(500).json({ message: "Lỗi lấy danh mục", error: error.message });
  }
};
