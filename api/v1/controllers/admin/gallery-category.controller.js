const GalleryCategory = require("../../models/gallery-category.model");
const buildTree = require("../../../../helpers/buildTree");
const createSlug = require("../../../../helpers/createSlug");
const collectDescendants = require("../../../../helpers/collectDescendants");
const mongoose = require("mongoose");
const { sendToQueue } = require("../../../../config/rabbitmq");
const { logBusiness } = require("../../../../services/businessLog.service");
// [GET] /gallery-category
module.exports.getAllCategories = async (req, res) => {
  try {
    const { tree } = req.query;
    const filter = { deleted: false };
    const categories = await GalleryCategory.find(filter).sort({
      createdAt: -1,
    });
    if (tree === "true") {
      return res.json(buildTree(categories));
    }
    return res.json(categories);
  } catch (error) {
    console.error("getAllCategories error:", error);
    res
      .status(500)
      .json({ message: "Lỗi lấy danh mục gallery", error: error.message });
  }
};

/**
 * GET /api/v1/gallery-category/recent?type=created|updated&limit=10
 * Trả về danh sách các mục mới/được cập nhật gần đây kèm subtree (nếu có)
 */
module.exports.getRecentCategories = async (req, res) => {
  try {
    const type = req.query.type === "updated" ? "updated" : "created";
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortField = type === "updated" ? "updatedAt" : "createdAt";

    // Lấy tất cả để có thể build subtree dễ dàng
    const all = await GalleryCategory.find({}).sort({ [sortField]: -1 });
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
    console.error("Lỗi lấy danh mục gallery gần nhất:", error);
    res.status(500).json({
      message: "Lỗi lấy danh mục gallery cập nhật gần nhất",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/gallery-category/:id
 */
module.exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Lấy danh mục + populate tên cha
    const category = await GalleryCategory.findById(id).populate(
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
 * POST /api/v1/gallery-category/create
 */
module.exports.createCategory = async (req, res) => {
  try {
    console.log(
      "🆕 createGalleryCategory called - Admin ID:",
      req.admin?.adminId
    );

    const { title, parentId, active } = req.body;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "System";

    const slug = createSlug(title);
    const newCategory = new GalleryCategory({
      title,
      parentId: parentId && parentId !== "" ? parentId : null,
      slug,
      active,
    });
    await newCategory.save();

    console.log("✅ Gallery category created:", newCategory.title);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId: adminId || null,
        adminName,
        action: "create",
        model: "GalleryCategory",
        recordIds: [newCategory._id],
        description: `Tạo danh mục gallery: ${newCategory.title}`,
        details: {
          categoryId: newCategory._id,
          categoryTitle: newCategory.title,
          categorySlug: newCategory.slug,
          parentId: newCategory.parentId,
          active: newCategory.active,
          hasParent: !!newCategory.parentId,
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
        category: "gallery-category-management",
        title: "Danh mục gallery mới được tạo",
        message: `${adminName} đã tạo danh mục gallery: ${newCategory.title}`,
        data: {
          categoryId: newCategory._id,
          categoryTitle: newCategory.title,
          categorySlug: newCategory.slug,
          parentId: newCategory.parentId,
          hasParent: !!newCategory.parentId,
          active: newCategory.active,
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
    console.error("❌ createGalleryCategory error:", error);
    res.status(500).json({ message: "Lỗi tạo danh mục", error: error.message });
  }
};

/**
 * PATCH /api/v1/gallery-category/update/:id
 */
module.exports.updateCategory = async (req, res) => {
  try {
    console.log(
      "✏️ updateGalleryCategory called - Admin ID:",
      req.admin?.adminId
    );

    const { id } = req.params;
    let { title, parentId, slug, active } = req.body;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "System";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Lấy dữ liệu cũ để so sánh
    const oldCategory = await GalleryCategory.findById(id);
    if (!oldCategory) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy danh mục gallery" });
    }

    // Nếu không nhập slug thì tự sinh từ title
    if (!slug || slug.trim() === "") {
      slug = createSlug(title);
    }

    // Kiểm tra slug đã tồn tại ở bản ghi khác chưa
    const existed = await GalleryCategory.findOne({
      slug,
      _id: { $ne: id },
    });
    if (existed) {
      return res.status(400).json({ message: "Slug gallery này đã tồn tại!" });
    }

    const updated = await GalleryCategory.findByIdAndUpdate(
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

    console.log("✅ Gallery category updated:", updated.title);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId: adminId || null,
        adminName,
        action: "update",
        model: "GalleryCategory",
        recordIds: [updated._id],
        description: `Cập nhật danh mục gallery: ${updated.title}`,
        details: {
          categoryId: updated._id,
          oldData: {
            title: oldCategory.title,
            slug: oldCategory.slug,
            parentId: oldCategory.parentId,
            active: oldCategory.active,
          },
          newData: {
            title: updated.title,
            slug: updated.slug,
            parentId: updated.parentId,
            active: updated.active,
          },
          changes: {
            titleChanged: oldCategory.title !== updated.title,
            slugChanged: oldCategory.slug !== updated.slug,
            parentChanged:
              oldCategory.parentId?.toString() !== updated.parentId?.toString(),
            activeChanged: oldCategory.active !== updated.active,
          },
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
        category: "gallery-category-management",
        title: "Danh mục gallery được cập nhật",
        message: `${adminName} đã cập nhật danh mục gallery: ${updated.title}`,
        data: {
          categoryId: updated._id,
          categoryTitle: updated.title,
          categorySlug: updated.slug,
          parentId: updated.parentId,
          active: updated.active,
          updatedBy: adminName,
          updatedAt: updated.updatedAt,
          oldTitle:
            oldCategory.title !== updated.title ? oldCategory.title : null,
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
    console.error("❌ updateGalleryCategory error:", error);
    res.status(500).json({
      message: "Lỗi cập nhật danh mục gallery",
      error: error.message,
    });
  }
};
/**
 * GET /api/v1/gallery-category/delete-info/:id
 * Lấy thông tin trước khi xóa
 */
module.exports.getDeleteCategoryInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const category = await GalleryCategory.findById(id).select("title");
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const allCategories = await GalleryCategory.find({});
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
    console.error("Lỗi lấy thông tin danh mục gallery:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin danh mục gallery",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/v1/gallery-category/delete/:id
 * Thực hiện soft delete danh mục và con cháu
 */
module.exports.deleteCategory = async (req, res) => {
  try {
    console.log(
      "🗑️ deleteGalleryCategory called - Admin ID:",
      req.admin?.adminId
    );

    const { id } = req.params;
    const adminId = req.admin?.adminId;
    const adminName = req.admin?.fullName || req.admin?.email || "System";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Không cho xóa danh mục gallery cha
    if (id === "68a2823b697ecb95bf141382") {
      return res
        .status(400)
        .json({ message: "Bạn không thể xóa danh mục gallery này!" });
    }

    const category = await GalleryCategory.findById(id).select("title");
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const allCategories = await GalleryCategory.find({});
    const categoryMap = Object.fromEntries(
      allCategories.map((c) => [c._id.toString(), c.toObject()])
    );
    const deleteIds = collectDescendants(id, categoryMap);

    // Lấy danh sách title của các category bị xóa để ghi log
    const deletedCategories = allCategories
      .filter((c) => deleteIds.includes(c._id.toString()))
      .map((c) => ({ id: c._id, title: c.title }));

    await GalleryCategory.updateMany(
      { _id: { $in: deleteIds } },
      { $set: { deleted: true, deletedAt: new Date() } }
    );

    console.log(`✅ Deleted ${deleteIds.length} gallery categories`);

    // 📝 GHI LOG BUSINESS
    try {
      await logBusiness({
        adminId: adminId || null,
        adminName,
        action: "delete",
        model: "GalleryCategory",
        recordIds: deleteIds.map((id) => new mongoose.Types.ObjectId(id)),
        description: `Xóa danh mục gallery "${category.title}" và ${
          deleteIds.length - 1
        } danh mục con`,
        details: {
          mainCategoryId: id,
          mainCategoryTitle: category.title,
          totalDeleted: deleteIds.length,
          deletedCategories: deletedCategories,
          isRecursiveDelete: deleteIds.length > 1,
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
        category: "gallery-category-management",
        title: "Danh mục gallery bị xóa",
        message: `${adminName} đã xóa danh mục gallery "${category.title}"${
          deleteIds.length > 1 ? ` và ${deleteIds.length - 1} danh mục con` : ""
        }`,
        data: {
          mainCategoryId: id,
          mainCategoryTitle: category.title,
          totalDeleted: deleteIds.length,
          deletedCategories: deletedCategories.slice(0, 5), // Giới hạn 5 items đầu
          deletedBy: adminName,
          deletedAt: new Date().toISOString(),
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

    res.json({
      success: true,
      categoryTitle: category.title,
      affectedCount: deleteIds.length,
    });
  } catch (error) {
    console.error("❌ deleteGalleryCategory error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa danh mục gallery",
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
    const latestCategory = await GalleryCategory.findOne({ deleted: false })
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
    console.error("Lỗi lấy danh mục gallery cập nhật mới nhất:", error);
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
    const latestCategory = await GalleryCategory.findOne({ deleted: false })
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
    console.error("Lỗi lấy danh mục gallery tạo mới nhất:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
