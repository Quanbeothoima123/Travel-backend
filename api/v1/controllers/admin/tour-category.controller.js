const TourCategory = require("../../models/tour-category.model");
const buildTree = require("../../../../helpers/buildTree");
const createSlug = require("../../../../helpers/createSlug");
const collectDescendants = require("../../../../helpers/collectDescendants");
const mongoose = require("mongoose");
// [GET] /tour-categories
exports.getAllCategories = async (req, res) => {
  try {
    const { tree } = req.query;
    const filter = { deleted: false };
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

/**
 * GET /api/v1/tour-categories/recent?type=created|updated&limit=10
 * Trả về danh sách các mục mới/được cập nhật gần đây kèm subtree (nếu có)
 */
exports.getRecentCategories = async (req, res) => {
  try {
    const type = req.query.type === "updated" ? "updated" : "created";
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortField = type === "updated" ? "updatedAt" : "createdAt";

    // Lấy tất cả để có thể build subtree dễ dàng
    const all = await TourCategory.find({}).sort({ [sortField]: -1 });
    // lọc những mục chưa bị xóa
    const active = all.filter((c) => !c.deleted);

    const recent = active.slice(0, limit);

    // build map id -> plain object
    const map = {};
    all.forEach((c) => {
      map[c._id.toString()] = c.toObject ? c.toObject() : { ...c };
    });

    // recursive build subtree for a root id
    const buildSub = (id) => {
      const node = map[id];
      if (!node) return null;
      const copy = { ...node, children: [] };
      Object.values(map).forEach((candidate) => {
        if (
          candidate.parentId &&
          candidate.parentId.toString() === id &&
          !candidate.deleted
        ) {
          const child = buildSub(candidate._id.toString());
          if (child) copy.children.push(child);
        }
      });
      return copy;
    };

    const results = recent
      .map((r) => buildSub(r._id.toString()))
      .filter(Boolean);

    return res.json(results);
  } catch (error) {
    console.error("getRecentCategories error:", error);
    res
      .status(500)
      .json({ message: "Lỗi lấy recent categories", error: error.message });
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
    const category = await TourCategory.findById(id).populate(
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
 * POST /api/v1/tour-categories/create
 */
exports.createCategory = async (req, res) => {
  try {
    const { title, parentId, active } = req.body;
    const slug = createSlug(title);
    const newCategory = new TourCategory({
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
    const existed = await TourCategory.findOne({
      slug,
      _id: { $ne: id },
    });
    if (existed) {
      return res
        .status(400)
        .json({ message: "Slug đã tồn tại, vui lòng chọn slug khác." });
    }

    const updated = await TourCategory.findByIdAndUpdate(
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

/**
 * GET /api/v1/tour-categories/delete-info/:id
 * Lấy thông tin trước khi xóa
 */
exports.getDeleteCategoryInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const category = await TourCategory.findById(id).select("title");
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const allCategories = await TourCategory.find({});
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
 * DELETE /api/v1/tours-categories/delete/:id
 * Thực hiện soft delete danh mục và con cháu
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }
    // Không cho xóa danh mục du lịch cha
    if (id === "68a1ae783856445e14a6aff2") {
      return res
        .status(400)
        .json({ message: "Bạn không thể xóa danh mục này!" });
    }

    const category = await TourCategory.findById(id).select("title");
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const allCategories = await TourCategory.find({});
    const categoryMap = Object.fromEntries(
      allCategories.map((c) => [c._id.toString(), c.toObject()])
    );
    const deleteIds = collectDescendants(id, categoryMap);

    await TourCategory.updateMany(
      { _id: { $in: deleteIds } },
      { $set: { deleted: true, deletedAt: new Date() } }
    );

    res.json({
      success: true,
      categoryTitle: category.title,
      affectedCount: deleteIds.length,
    });
  } catch (error) {
    console.error("Xóa danh mục du lịch không thành công:", error);
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
    const latestCategory = await TourCategory.findOne({ deleted: false })
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
    const latestCategory = await TourCategory.findOne({ deleted: false })
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
