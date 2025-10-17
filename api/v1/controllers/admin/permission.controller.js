// controllers/admin/permissions.controller.js
const Permission = require("../../models/permission.model");

// [GET] /api/admin/v1/permission
// Lấy tất cả permissions
module.exports.index = async (req, res) => {
  try {
    const permissions = await Permission.find({ deleted: false }).sort({
      module: 1,
      order: 1,
    });

    res.json(permissions);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({
      message: "Không thể tải danh sách permissions",
      error: error.message,
    });
  }
};

// [GET] /api/admin/v1/permission/:id
// Lấy chi tiết 1 permission
module.exports.detail = async (req, res) => {
  try {
    const permission = await Permission.findOne({
      _id: req.params.id,
      deleted: false,
    });

    if (!permission) {
      return res.status(404).json({ message: "Không tìm thấy permission" });
    }

    res.json(permission);
  } catch (error) {
    console.error("Error fetching permission:", error);
    res.status(500).json({
      message: "Không thể tải permission",
      error: error.message,
    });
  }
};

// [POST] /api/admin/permission/create
// Tạo permission mới
module.exports.create = async (req, res) => {
  try {
    const { name, displayName, module, action, description, order } = req.body;

    // Validate required fields
    if (!name || !displayName || !module || !action) {
      return res.status(400).json({
        message: "Vui lòng điền đầy đủ thông tin bắt buộc",
      });
    }

    // Check if permission name already exists
    const existingPerm = await Permission.findOne({ name, deleted: false });
    if (existingPerm) {
      return res.status(400).json({
        message: "Tên permission đã tồn tại",
      });
    }

    // Create new permission
    const newPermission = new Permission({
      name,
      displayName,
      module,
      action,
      description: description || "",
      order: order || 0,
    });

    await newPermission.save();

    res.status(201).json({
      message: "Tạo permission thành công",
      data: newPermission,
    });
  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({
      message: "Không thể tạo permission",
      error: error.message,
    });
  }
};

// [PATCH] /api/admin/v1/permission/update/:id
// Cập nhật permission
module.exports.update = async (req, res) => {
  try {
    const { name, displayName, module, action, description, order } = req.body;

    const permission = await Permission.findOne({
      _id: req.params.id,
      deleted: false,
    });

    if (!permission) {
      return res.status(404).json({ message: "Không tìm thấy permission" });
    }

    // Check if new name conflicts with existing
    if (name && name !== permission.name) {
      const existingPerm = await Permission.findOne({
        name,
        deleted: false,
        _id: { $ne: req.params.id },
      });
      if (existingPerm) {
        return res.status(400).json({
          message: "Tên permission đã tồn tại",
        });
      }
    }

    // Update fields
    if (name) permission.name = name;
    if (displayName) permission.displayName = displayName;
    if (module) permission.module = module;
    if (action) permission.action = action;
    if (description !== undefined) permission.description = description;
    if (order !== undefined) permission.order = order;

    await permission.save();

    res.json({
      message: "Cập nhật permission thành công",
      data: permission,
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({
      message: "Không thể cập nhật permission",
      error: error.message,
    });
  }
};

// [DELETE] /api/v1/admin/permission/delete/:id
// Xóa permission (soft delete)
module.exports.delete = async (req, res) => {
  try {
    const permission = await Permission.findOne({
      _id: req.params.id,
      deleted: false,
    });

    if (!permission) {
      return res.status(404).json({ message: "Không tìm thấy permission" });
    }

    // Soft delete
    permission.deleted = true;
    permission.deletedAt = new Date();
    await permission.save();

    // TODO: Remove this permission from all roles
    const Role = require("../../models/Role");
    await Role.updateMany(
      { permissions: permission.name },
      { $pull: { permissions: permission.name } }
    );

    res.json({ message: "Xóa permission thành công" });
  } catch (error) {
    console.error("Error deleting permission:", error);
    res.status(500).json({
      message: "Không thể xóa permission",
      error: error.message,
    });
  }
};
