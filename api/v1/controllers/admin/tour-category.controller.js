const TourCategory = require("../../models/tour-category.model");
const buildTree = require("../../../../helpers/buildTree");
const createSlug = require("../../../../helpers/createSlug");
const collectDescendants = require("../../../../helpers/collectDescendants");
const mongoose = require("mongoose");
const { sendToQueue } = require("../../../../config/rabbitmq");
const { logBusiness } = require("../../../../services/businessLog.service");

// [GET] /tour-categories
module.exports.getAllCategories = async (req, res) => {
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
module.exports.getRecentCategories = async (req, res) => {
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
module.exports.getCategoryById = async (req, res) => {
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
 * ✅ CÓ LOG + NOTIFICATION
 */
module.exports.createCategory = async (req, res) => {
  try {
    console.log("🆕 createCategory called - Admin ID:", req.admin?.adminId);

    const { title, parentId, active } = req.body;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "System";

    const slug = createSlug(title);
    const newCategory = new TourCategory({
      title,
      parentId: parentId && parentId !== "" ? parentId : null,
      slug,
      active,
    });
    await newCategory.save();

    console.log("✅ Category created:", newCategory.title);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId: adminId || null,
        adminName,
        action: "create",
        model: "TourCategory",
        recordIds: [newCategory._id],
        description: `Tạo danh mục tour: ${newCategory.title}`,
        details: {
          categoryId: newCategory._id,
          categoryTitle: newCategory.title,
          categorySlug: newCategory.slug,
          parentId: newCategory.parentId,
          active: newCategory.active,
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION
    try {
      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "category-management",
        title: "Danh mục tour mới được tạo",
        message: `${adminName} đã tạo danh mục: ${newCategory.title}`,
        data: {
          categoryId: newCategory._id,
          categoryTitle: newCategory.title,
          categorySlug: newCategory.slug,
          createdBy: adminName,
          createdAt: newCategory.createdAt,
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    res.status(201).json(newCategory);
  } catch (error) {
    console.error("❌ createCategory error:", error);
    res.status(500).json({ message: "Lỗi tạo danh mục", error: error.message });
  }
};

/**
 * PATCH /api/v1/tour-categories/update/:id
 * ✅ CÓ LOG + NOTIFICATION
 */
module.exports.updateCategory = async (req, res) => {
  try {
    console.log("📝 updateCategory called - Admin ID:", req.admin?.adminId);

    const { id } = req.params;
    let { title, parentId, slug, active } = req.body;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "System";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Lấy dữ liệu cũ để so sánh
    const oldCategory = await TourCategory.findById(id);
    if (!oldCategory) {
      return res.status(404).json({ message: "Không tìm thấy danh mục" });
    }

    const oldData = {
      title: oldCategory.title,
      slug: oldCategory.slug,
      parentId: oldCategory.parentId,
      active: oldCategory.active,
    };

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

    console.log("✅ Category updated:", updated.title);

    // Track changes
    const changes = {};
    if (oldData.title !== updated.title) {
      changes.title = { from: oldData.title, to: updated.title };
    }
    if (oldData.slug !== updated.slug) {
      changes.slug = { from: oldData.slug, to: updated.slug };
    }
    if (String(oldData.parentId) !== String(updated.parentId)) {
      changes.parentId = { from: oldData.parentId, to: updated.parentId };
    }
    if (oldData.active !== updated.active) {
      changes.active = { from: oldData.active, to: updated.active };
    }

    const changedFields = Object.keys(changes);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId: adminId || null,
        adminName,
        action: "update",
        model: "TourCategory",
        recordIds: [updated._id],
        description: `Cập nhật danh mục tour: ${updated.title}`,
        details: {
          categoryId: updated._id,
          categoryTitle: updated.title,
          changedFields,
          changes,
          oldTitle: oldData.title !== updated.title ? oldData.title : undefined,
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION
    try {
      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "category-management",
        title: "Danh mục tour đã được cập nhật",
        message: `${adminName} đã cập nhật danh mục: ${updated.title}`,
        data: {
          categoryId: updated._id,
          categoryTitle: updated.title,
          updatedBy: adminName,
          updatedAt: updated.updatedAt,
          changedFields,
          oldTitle: oldData.title !== updated.title ? oldData.title : undefined,
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    res.json(updated);
  } catch (error) {
    console.error("❌ updateCategory error:", error);
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
module.exports.getDeleteCategoryInfo = async (req, res) => {
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
 * ✅ CÓ LOG + NOTIFICATION
 */
module.exports.deleteCategory = async (req, res) => {
  try {
    console.log("🗑️ deleteCategory called - Admin ID:", req.admin?.adminId);

    const { id } = req.params;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "System";

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

    console.log(
      `✅ Deleted ${deleteIds.length} categories (including descendants)`
    );

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId: adminId || null,
        adminName,
        action: "delete",
        model: "TourCategory",
        recordIds: deleteIds,
        description: `Xóa danh mục tour: ${category.title} (bao gồm ${deleteIds.length} danh mục con)`,
        details: {
          categoryId: id,
          categoryTitle: category.title,
          affectedCount: deleteIds.length,
          deleteIds,
          deletedAt: new Date(),
          deletionType: "soft_delete_cascade", // Xóa cascade cả con cháu
        },
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      console.log("✅ Business log recorded");
    } catch (logError) {
      console.error("❌ Error logging business:", logError.message);
    }

    // 🐰 GỬI NOTIFICATION
    try {
      const notificationMessage = {
        id: Date.now().toString(),
        type: "admin-action",
        category: "category-management",
        title: "Danh mục tour đã bị xóa",
        message: `${adminName} đã xóa danh mục: ${category.title} (${deleteIds.length} danh mục bị ảnh hưởng)`,
        data: {
          categoryId: id,
          categoryTitle: category.title,
          affectedCount: deleteIds.length,
          deletedBy: adminName,
          deletedAt: new Date().toISOString(),
          canRestore: true,
          isCascade: deleteIds.length > 1, // Có xóa con cháu không
        },
        unread: true,
        timestamp: new Date().toISOString(),
        time: "Vừa xong",
      };

      const sent = await sendToQueue(
        "notifications.admin",
        notificationMessage
      );
      if (sent) {
        console.log("✅ Delete notification sent to RabbitMQ");
      }
    } catch (queueError) {
      console.error("❌ RabbitMQ error:", queueError.message);
    }

    res.json({
      success: true,
      categoryTitle: category.title,
      affectedCount: deleteIds.length,
    });
  } catch (error) {
    console.error("❌ Xóa danh mục du lịch không thành công:", error);
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
module.exports.getLatestUpdatedCategory = async (req, res) => {
  try {
    const latestCategory = await TourCategory.findOne({ deleted: false })
      .sort({ updatedAt: -1 })
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
module.exports.getLatestCreatedCategory = async (req, res) => {
  try {
    const latestCategory = await TourCategory.findOne({ deleted: false })
      .sort({ createdAt: -1 })
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
