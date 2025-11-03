const NewsCategory = require("../../models/new-category.model");
const buildTree = require("../../../../helpers/buildTree");
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

// [GET] /api/v1/news-categories/getAll
module.exports.getAllNewCategories = async (req, res) => {
  try {
    const { tree } = req.query;
    const filter = { deleted: false, active: true };

    const newCategories = await NewsCategory.find(filter).sort({
      createdAt: -1,
    });
    if (tree === "true") {
      return res.json(buildTree(newCategories));
    }
    return res.json(newCategories);
  } catch (error) {
    console.error("Lỗi lấy danh mục tin tức:", error);
    res.status(500).json({ message: "Lỗi lấy danh mục", error: error.message });
  }
};
