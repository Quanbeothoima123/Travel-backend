const AdminAccount = require("../../models/admin-account.model");
const Role = require("../../models/role.model");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

// [GET] /api/v1/admin/accounts - Lấy danh sách tài khoản với filter, search, sort, pagination
module.exports.index = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      status = "",
      dateStart = "",
      dateEnd = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = { deleted: false };

    // Search by fullName or email
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by role
    if (role && role !== "all") {
      filter.role_id = role;
    }

    // Filter by status
    if (status && status !== "all") {
      filter.status = status;
    }

    // Filter by date range
    if (dateStart || dateEnd) {
      filter.createdAt = {};
      if (dateStart) {
        filter.createdAt.$gte = new Date(dateStart);
      }
      if (dateEnd) {
        const endDate = new Date(dateEnd);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get total count
    const total = await AdminAccount.countDocuments(filter);

    // Get accounts
    const accounts = await AdminAccount.find(filter)
      .populate("role_id", "title value")
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      accounts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
        total,
      },
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách tài khoản",
      error: error.message,
    });
  }
};

// [POST] /api/v1/admin/accounts/create - Tạo tài khoản mới
module.exports.create = async (req, res) => {
  try {
    const { fullName, email, password, phone, avatar, role_id, status } =
      req.body;

    // Validate required fields
    if (!fullName || !email || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin bắt buộc",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    // Check if email already exists
    const existingAccount = await AdminAccount.findOne({
      email: email.toLowerCase(),
      deleted: false,
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "Email đã tồn tại trong hệ thống",
      });
    }

    // Check if role exists
    const roleExists = await Role.findOne({ _id: role_id, deleted: false });
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: "Vai trò không tồn tại",
      });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new account
    const newAccount = new AdminAccount({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone: phone || "",
      avatar: avatar || "",
      role_id,
      status: status || "active",
    });

    await newAccount.save();

    // Return account without password
    const accountResponse = await AdminAccount.findById(newAccount._id)
      .populate("role_id", "title value")
      .select("-password")
      .lean();

    res.status(201).json({
      success: true,
      message: "Tạo tài khoản thành công",
      account: accountResponse,
    });
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo tài khoản",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/accounts/:id - Lấy chi tiết một tài khoản
module.exports.detail = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await AdminAccount.findOne({
      _id: id,
      deleted: false,
    })
      .populate("role_id")
      .select("-password")
      .lean();

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.json({
      success: true,
      account,
    });
  } catch (error) {
    console.error("Error fetching account detail:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin tài khoản",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/accounts/update/:id - Cập nhật tài khoản
module.exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, password, phone, avatar, role_id, status } =
      req.body;

    // Check if account exists
    const account = await AdminAccount.findOne({
      _id: id,
      deleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Check if email is being changed and already exists
    if (email && email.toLowerCase() !== account.email) {
      const existingAccount = await AdminAccount.findOne({
        email: email.toLowerCase(),
        deleted: false,
        _id: { $ne: id },
      });

      if (existingAccount) {
        return res.status(400).json({
          success: false,
          message: "Email đã tồn tại trong hệ thống",
        });
      }
    }

    // Check if role exists
    if (role_id) {
      const roleExists = await Role.findOne({ _id: role_id, deleted: false });
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Vai trò không tồn tại",
        });
      }
    }

    // Build update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (role_id) updateData.role_id = role_id;
    if (status) updateData.status = status;

    // Hash password if provided (using bcrypt)
    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu phải có ít nhất 6 ký tự",
        });
      }
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Update account
    await AdminAccount.findByIdAndUpdate(id, updateData);

    // Get updated account
    const updatedAccount = await AdminAccount.findById(id)
      .populate("role_id", "title value")
      .select("-password")
      .lean();

    res.json({
      success: true,
      message: "Cập nhật tài khoản thành công",
      account: updatedAccount,
    });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật tài khoản",
      error: error.message,
    });
  }
};

// [DELETE] /api/v1/admin/accounts/delete/:id - Xóa tài khoản (soft delete)
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await AdminAccount.findOne({
      _id: id,
      deleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Soft delete
    await AdminAccount.findByIdAndUpdate(id, {
      deleted: true,
      deletedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Xóa tài khoản thành công",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa tài khoản",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/accounts/bulk-status - Cập nhật trạng thái hàng loạt
module.exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { accountIds, status } = req.body;

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách tài khoản không hợp lệ",
      });
    }

    if (!["active", "inactive", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const result = await AdminAccount.updateMany(
      {
        _id: { $in: accountIds },
        deleted: false,
      },
      {
        status,
      }
    );

    res.json({
      success: true,
      message: `Cập nhật trạng thái cho ${result.modifiedCount} tài khoản thành công`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error bulk updating status:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái hàng loạt",
      error: error.message,
    });
  }
};

// [DELETE] /api/v1/admin/accounts/bulk-delete - Xóa hàng loạt tài khoản
module.exports.bulkDelete = async (req, res) => {
  try {
    const { accountIds } = req.body;

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách tài khoản không hợp lệ",
      });
    }

    const result = await AdminAccount.updateMany(
      {
        _id: { $in: accountIds },
        deleted: false,
      },
      {
        deleted: true,
        deletedAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: `Xóa ${result.modifiedCount} tài khoản thành công`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting accounts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa tài khoản hàng loạt",
      error: error.message,
    });
  }
};

module.exports.getProfile = async (req, res) => {
  try {
    const account = await AdminAccount.findOne({
      _id: req.admin._id,
      deleted: false,
    })
      .populate("role_id", "title value description permissions")
      .select("-password")
      .lean();

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.json({
      success: true,
      profile: account,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin profile",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/profile/update - Cập nhật thông tin profile
module.exports.updateProfile = async (req, res) => {
  try {
    const accountId = req.admin._id;
    const { fullName, phone, avatar } = req.body;

    const account = await AdminAccount.findOne({
      _id: accountId,
      deleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Lưu dữ liệu cũ để log
    const oldData = {
      fullName: account.fullName,
      phone: account.phone,
      avatar: account.avatar,
    };

    // Build update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;

    // Update account
    await AdminAccount.findByIdAndUpdate(accountId, updateData);

    // Get updated account
    const updatedAccount = await AdminAccount.findById(accountId)
      .populate("role_id", "title value description permissions")
      .select("-password")
      .lean();

    // ✅ GHI LOG NGHIỆP VỤ
    await logBusiness({
      adminId: req.admin._id,
      adminName: req.admin.fullName,
      action: "update",
      model: "AdminAccount",
      recordIds: [accountId],
      description: `${req.admin.fullName} đã cập nhật thông tin cá nhân`,
      details: {
        before: oldData,
        after: {
          fullName: updatedAccount.fullName,
          phone: updatedAccount.phone,
          avatar: updatedAccount.avatar,
        },
      },
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // ✅ GỬI NOTIFICATION QUA RABBITMQ
    await sendToQueue("notifications.admin", {
      type: "profile_updated",
      adminId: req.admin._id.toString(),
      adminName: req.admin.fullName,
      message: `${req.admin.fullName} đã cập nhật thông tin cá nhân`,
      timestamp: new Date().toISOString(),
      data: {
        changes: Object.keys(updateData),
      },
    });

    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      profile: updatedAccount,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật thông tin",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/profile/change-password - Đổi mật khẩu
module.exports.changePassword = async (req, res) => {
  try {
    const accountId = req.admin._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới và xác nhận mật khẩu không khớp",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    // Get account with password
    const account = await AdminAccount.findOne({
      _id: accountId,
      deleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      account.password
    );

    if (!isPasswordValid) {
      // ✅ LOG ATTEMPT FAILED
      await logBusiness({
        adminId: req.admin._id,
        adminName: req.admin.fullName,
        action: "update",
        model: "AdminAccount",
        recordIds: [accountId],
        description: `${req.admin.fullName} đã thử đổi mật khẩu nhưng mật khẩu hiện tại không đúng`,
        details: {
          status: "failed",
          reason: "Incorrect current password",
        },
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
      });

      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await AdminAccount.findByIdAndUpdate(accountId, {
      password: hashedPassword,
    });

    // ✅ GHI LOG NGHIỆP VỤ
    await logBusiness({
      adminId: req.admin._id,
      adminName: req.admin.fullName,
      action: "update",
      model: "AdminAccount",
      recordIds: [accountId],
      description: `${req.admin.fullName} đã đổi mật khẩu thành công`,
      details: {
        action: "password_changed",
        timestamp: new Date().toISOString(),
      },
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // ✅ GỬI NOTIFICATION QUA RABBITMQ (cảnh báo bảo mật)
    await sendToQueue("notifications.admin", {
      type: "password_changed",
      adminId: req.admin._id.toString(),
      adminName: req.admin.fullName,
      message: `Mật khẩu của tài khoản ${req.admin.fullName} đã được thay đổi`,
      timestamp: new Date().toISOString(),
      priority: "high", // Đánh dấu quan trọng
      data: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đổi mật khẩu",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/profile/stats - Lấy thống kê hoạt động
module.exports.getStats = async (req, res) => {
  try {
    const accountId = req.admin._id;

    const account = await AdminAccount.findOne({
      _id: accountId,
      deleted: false,
    }).select("createdAt lastLogin");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    // Tính số ngày đã tham gia
    const daysJoined = Math.floor(
      (new Date() - account.createdAt) / (1000 * 60 * 60 * 24)
    );

    res.json({
      success: true,
      stats: {
        accountCreated: account.createdAt,
        lastLogin: account.lastLogin,
        daysJoined,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê",
      error: error.message,
    });
  }
};
