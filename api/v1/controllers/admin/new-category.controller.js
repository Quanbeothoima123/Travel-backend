const NewsCategory = require("../../models/new-category.model");
const buildTree = require("../../../../helpers/buildTree");
const collectDescendants = require("../../../../helpers/collectDescendants");
const mongoose = require("mongoose");
const createSlug = require("../../../../helpers/createSlug");
// [GET] /api/v1/news-categories/getAll
module.exports.getAllNewCategories = async (req, res) => {
  try {
    const { tree } = req.query;
    const filter = { deleted: false };

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

/**
 * POST /api/v1/admin/news-category/create
 */
exports.createCategory = async (req, res) => {
  try {
    const { title, parentId, active } = req.body;
    const slug = createSlug(title);
    const newCategory = new NewsCategory({
      title,
      parentId: parentId && parentId !== "" ? parentId : null,
      slug,
      active,
    });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    console.error("createCategory error:", error);
    res.status(500).json({ message: "Lỗi tạo danh mục", error: error.message });
  }
};
/**
 * GET /api/v1/tour-categories/:id
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Lấy danh mục + populate tên cha
    const category = await NewsCategory.findById(id).populate(
      "parentId",
      "title _id"
    );

    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục" });
    }

    // Đảm bảo dữ liệu trả về đầy đủ, fallback "Chưa có thông tin"
    const detail = {
      _id: category._id,
      title: category.title || "Chưa có thông tin",
      slug: category.slug || "Chưa có thông tin",
      active:
        typeof category.active === "boolean"
          ? category.active
          : "Chưa có thông tin",
      createdAt: category.createdAt || "Chưa có thông tin",
      updatedAt: category.updatedAt || "Chưa có thông tin",
      deleted: category.deleted ?? false,
      deletedAt: category.deletedAt || "Chưa có thông tin",
      parent: category.parentId
        ? { _id: category.parentId._id, title: category.parentId.title }
        : "Chưa có thông tin",
    };

    res.json(detail);
  } catch (error) {
    console.error("getCategoryById error:", error);
    res
      .status(500)
      .json({ message: "Lỗi lấy chi tiết danh mục", error: error.message });
  }
};

/**
 * PATCH /api/v1/tour-categories/update/:id
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, parentId, slug, active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Nếu không nhập slug thì tự sinh từ title
    if (!slug || slug.trim() === "") {
      slug = createSlug(title);
    }

    // Kiểm tra slug đã tồn tại ở bản ghi khác chưa
    const existed = await NewsCategory.findOne({
      slug,
      _id: { $ne: id },
    });
    if (existed) {
      return res
        .status(400)
        .json({ message: "Slug đã tồn tại, vui lòng chọn slug khác." });
    }

    const updated = await NewsCategory.findByIdAndUpdate(
      id,
      {
        $set: {
          title,
          parentId: parentId && parentId !== "" ? parentId : null,
          slug,
          active: typeof active === "boolean" ? active : true,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy danh mục" });
    }

    res.json(updated);
  } catch (error) {
    console.error("updateCategory error:", error);
    res.status(500).json({
      message: "Lỗi cập nhật danh mục",
      error: error.message,
    });
  }
};

// [GET] /api/v1/news-categories/get-by-id/:id
module.exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const newCategory = await NewsCategory.findById({ _id: id });
    return res.json(newCategory);
  } catch (error) {
    console.error("Lỗi lấy danh mục tin tức:", error);
    res.status(500).json({ message: "Lỗi lấy danh mục", error: error.message });
  }
};

/**
 * GET /api/v1/news-categories/delete-info/:id
 * Lấy thông tin trước khi xóa
 */
exports.getDeleteCategoryInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const category = await NewsCategory.findById(id).select("title");
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const allCategories = await NewsCategory.find({});
    const categoryMap = Object.fromEntries(
      allCategories.map((c) => [c._id.toString(), c.toObject()])
    );
    const deleteIds = collectDescendants(id, categoryMap);

    res.json({
      success: true,
      categoryTitle: category.title,
      affectedCount: deleteIds.length,
    });
  } catch (error) {
    console.error("Lấy info xóa danh mục không thành công:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin danh mục",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/v1/news-categories/delete/:id
 * Thực hiện soft delete danh mục và con cháu
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }
    // Không cho xóa danh mục tin tức cha
    if (id === "68a28091697ecb95bf141378") {
      return res
        .status(400)
        .json({ message: "Bạn không thể xóa danh mục này!" });
    }

    const category = await NewsCategory.findById(id).select("title");
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const allCategories = await NewsCategory.find({});
    const categoryMap = Object.fromEntries(
      allCategories.map((c) => [c._id.toString(), c.toObject()])
    );
    const deleteIds = collectDescendants(id, categoryMap);

    await NewsCategory.updateMany(
      { _id: { $in: deleteIds } },
      { $set: { deleted: true, deletedAt: new Date() } }
    );

    res.json({
      success: true,
      categoryTitle: category.title,
      affectedCount: deleteIds.length,
    });
  } catch (error) {
    console.error("Xóa danh mục tin tức không thành công:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa danh mục",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/news-category/latest-updated
 * Lấy ID của danh mục được cập nhật mới nhất
 */
exports.getLatestUpdatedCategory = async (req, res) => {
  try {
    const latestCategory = await NewsCategory.findOne({ deleted: false })
      .sort({ updatedAt: -1 }) // sắp xếp giảm dần theo updatedAt
      .select("_id title updatedAt");

    if (!latestCategory) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục nào",
      });
    }

    res.json({
      success: true,
      latestId: latestCategory._id,
      title: latestCategory.title,
      updatedAt: latestCategory.updatedAt,
    });
  } catch (error) {
    console.error("Lỗi lấy danh mục cập nhật mới nhất:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
/**
 * GET /api/v1/admin/news-category/latest-created
 * Lấy ID của danh mục được tạo mới nhất
 */
exports.getLatestCreatedCategory = async (req, res) => {
  try {
    const latestCategory = await NewsCategory.findOne({ deleted: false })
      .sort({ createdAt: -1 }) // sắp xếp giảm dần theo createdAt
      .select("_id title createdAt");

    if (!latestCategory) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục nào",
      });
    }

    res.json({
      success: true,
      latestId: latestCategory._id,
      title: latestCategory.title,
      createdAt: latestCategory.createdAt,
    });
  } catch (error) {
    console.error("Lỗi lấy danh mục tạo mới nhất:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
