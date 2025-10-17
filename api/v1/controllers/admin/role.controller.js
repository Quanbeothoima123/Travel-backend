// controllers/admin/roles.controller.js
const Role = require("../../models/role.model");
const Permission = require("../../models/permission.model");
const AdminAccount = require("../../models/admin-account.model");

// [GET] /api/v1/admin/role
// Lấy tất cả roles
module.exports.index = async (req, res) => {
  try {
    const roles = await Role.find({ deleted: false }).sort({ createdAt: -1 });

    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({
      message: "Không thể tải danh sách vai trò",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/role/:id
// Lấy chi tiết 1 role
module.exports.detail = async (req, res) => {
  try {
    const role = await Role.findOne({
      _id: req.params.id,
      deleted: false,
    });

    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy vai trò" });
    }

    res.json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({
      message: "Không thể tải vai trò",
      error: error.message,
    });
  }
};

// [POST] /api/v1/admin/role/create
// Tạo role mới
module.exports.create = async (req, res) => {
  try {
    const { title, value, description, permissions } = req.body;

    // Validate required fields
    if (!title || !value) {
      return res.status(400).json({
        message: "Vui lòng điền đầy đủ thông tin bắt buộc",
      });
    }

    // Check if role value already exists
    const existingRole = await Role.findOne({ value, deleted: false });
    if (existingRole) {
      return res.status(400).json({
        message: "Giá trị vai trò đã tồn tại",
      });
    }

    // Validate permissions if provided
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        name: { $in: permissions },
        deleted: false,
      });

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({
          message: "Một số permission không hợp lệ",
        });
      }
    }

    // Create new role
    const newRole = new Role({
      title,
      value,
      description: description || "",
      permissions: permissions || [],
    });

    await newRole.save();

    res.status(201).json({
      message: "Tạo vai trò thành công",
      data: newRole,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({
      message: "Không thể tạo vai trò",
      error: error.message,
    });
  }
};

// [PATCH] /api/admin/role/update/:id
// Cập nhật role
module.exports.update = async (req, res) => {
  try {
    const { title, value, description, permissions } = req.body;

    const role = await Role.findOne({
      _id: req.params.id,
      deleted: false,
    });

    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy vai trò" });
    }

    // Check if new value conflicts with existing
    if (value && value !== role.value) {
      const existingRole = await Role.findOne({
        value,
        deleted: false,
        _id: { $ne: req.params.id },
      });
      if (existingRole) {
        return res.status(400).json({
          message: "Giá trị vai trò đã tồn tại",
        });
      }
    }

    // Validate permissions if provided
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        name: { $in: permissions },
        deleted: false,
      });

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({
          message: "Một số permission không hợp lệ",
        });
      }
    }

    // Update fields
    if (title) role.title = title;
    if (value) role.value = value;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();

    res.json({
      message: "Cập nhật vai trò thành công",
      data: role,
    });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({
      message: "Không thể cập nhật vai trò",
      error: error.message,
    });
  }
};

// [DELETE] /api/admin/role/:id
// Xóa role (soft delete)
module.exports.delete = async (req, res) => {
  try {
    const role = await Role.findOne({
      _id: req.params.id,
      deleted: false,
    });

    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy vai trò" });
    }

    // Check if any admin accounts are using this role
    const accountsUsingRole = await AdminAccount.countDocuments({
      role_id: role._id,
      deleted: false,
    });

    if (accountsUsingRole > 0) {
      return res.status(400).json({
        message: `Không thể xóa vai trò này vì có ${accountsUsingRole} tài khoản đang sử dụng`,
      });
    }

    // Soft delete
    role.deleted = true;
    role.deletedAt = new Date();
    await role.save();

    res.json({ message: "Xóa vai trò thành công" });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({
      message: "Không thể xóa vai trò",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/role/udpate-permissions
// Cập nhật permissions cho nhiều roles cùng lúc
module.exports.updatePermissions = async (req, res) => {
  try {
    const { roles } = req.body;

    if (!roles || !Array.isArray(roles)) {
      return res.status(400).json({
        message: "Dữ liệu không hợp lệ",
      });
    }

    // Validate all permissions exist
    const allPermissions = [...new Set(roles.flatMap((r) => r.permissions))];
    const validPermissions = await Permission.find({
      name: { $in: allPermissions },
      deleted: false,
    });

    const validPermissionNames = validPermissions.map((p) => p.name);

    // Update each role
    let updated = 0;
    for (const roleData of roles) {
      const role = await Role.findOne({
        _id: roleData.roleId,
        deleted: false,
      });

      if (role) {
        // Filter out invalid permissions
        const validRolePerms = roleData.permissions.filter((p) =>
          validPermissionNames.includes(p)
        );

        role.permissions = validRolePerms;
        await role.save();
        updated++;
      }
    }

    res.json({
      message: "Cập nhật phân quyền thành công",
      updated,
    });
  } catch (error) {
    console.error("Error updating permissions:", error);
    res.status(500).json({
      message: "Không thể cập nhật phân quyền",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/role/permissions/matrix
// Lấy ma trận permissions (dùng cho trang phân quyền)
module.exports.getPermissionsMatrix = async (req, res) => {
  try {
    const roles = await Role.find({ deleted: false });
    const permissions = await Permission.find({ deleted: false }).sort({
      module: 1,
      order: 1,
    });

    const matrix = {};
    roles.forEach((role) => {
      matrix[role._id] = role.permissions || [];
    });

    res.json({
      roles,
      permissions,
      matrix,
    });
  } catch (error) {
    console.error("Error fetching permissions matrix:", error);
    res.status(500).json({
      message: "Không thể tải ma trận phân quyền",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/role/stats
// Lấy thống kê số lượng accounts cho mỗi role
module.exports.getStats = async (req, res) => {
  try {
    const roles = await Role.find({ deleted: false });

    // Đếm số accounts cho từng role
    const statsPromises = roles.map(async (role) => {
      const accountCount = await AdminAccount.countDocuments({
        role_id: role._id,
        deleted: false,
      });

      return {
        roleId: role._id,
        roleTitle: role.title,
        roleValue: role.value,
        accountCount: accountCount,
        permissionCount: role.permissions ? role.permissions.length : 0,
      };
    });

    const stats = await Promise.all(statsPromises);

    res.json(stats);
  } catch (error) {
    console.error("Error fetching role stats:", error);
    res.status(500).json({
      message: "Không thể tải thống kê vai trò",
      error: error.message,
    });
  }
};
