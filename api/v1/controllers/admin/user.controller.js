// controllers/admin/user.controller.js
const User = require("../../models/user.model");
const Invoice = require("../../models/invoice.model");

// [GET] /api/v1/admin/user/list
module.exports.getUserList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      gender = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = { deleted: false };

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (gender) {
      filter.sex = gender;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get users with aggregation to calculate totalSpent and totalBookings
    const users = await User.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "invoices",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$userId", "$$userId"] },
                status: { $in: ["paid", "completed"] },
              },
            },
            {
              $group: {
                _id: null,
                totalSpent: { $sum: "$totalPrice" },
                totalBookings: { $sum: 1 },
              },
            },
          ],
          as: "bookingStats",
        },
      },
      {
        $addFields: {
          totalSpent: {
            $ifNull: [{ $arrayElemAt: ["$bookingStats.totalSpent", 0] }, 0],
          },
          totalBookings: {
            $ifNull: [{ $arrayElemAt: ["$bookingStats.totalBookings", 0] }, 0],
          },
        },
      },
      { $project: { bookingStats: 0, password: 0, securityCode: 0 } },
      { $sort: sort },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      users,
      total,
      totalPages,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách người dùng",
    });
  }
};

// [GET] /api/v1/admin/user/detail/:userId
module.exports.getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-password -securityCode")
      .populate("province")
      .populate("ward");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Get booking stats
    const bookingStats = await Invoice.aggregate([
      {
        $match: {
          userId: user._id,
          status: { $in: ["paid", "completed"] },
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$totalPrice" },
          totalBookings: { $sum: 1 },
        },
      },
    ]);

    // Get recent bookings
    const recentBookings = await Invoice.find({
      userId: user._id,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("invoiceCode totalPrice createdAt status");

    const userDetail = {
      ...user.toObject(),
      totalSpent: bookingStats[0]?.totalSpent || 0,
      totalBookings: bookingStats[0]?.totalBookings || 0,
      recentBookings,
    };

    res.json(userDetail);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin người dùng",
    });
  }
};

// [PATCH] /api/v1/admin/user/bulk-update-status
module.exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { userIds, status } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách người dùng không hợp lệ",
      });
    }

    if (!["active", "inactive", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái cho ${userIds.length} người dùng`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái",
    });
  }
};

// [PATCH] /api/v1/admin/user/update-status/:userId
module.exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["active", "inactive", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    user.status = status;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      user: {
        _id: user._id,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái",
    });
  }
};

// [GET] /api/v1/admin/user/statistics
module.exports.getUserStatistics = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments({ deleted: false });

    // Active users
    const activeUsers = await User.countDocuments({
      deleted: false,
      status: "active",
    });

    // Total revenue from paid invoices
    const revenueStats = await Invoice.aggregate([
      {
        $match: {
          status: { $in: ["paid", "completed"] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalPrice" },
          totalBookings: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      totalUsers,
      activeUsers,
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
      totalBookings: revenueStats[0]?.totalBookings || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê",
    });
  }
};

// [GET] /api/v1/admin/user/export
module.exports.exportUsers = async (req, res) => {
  try {
    const { search = "", status = "", gender = "" } = req.query;

    // Build filter
    const filter = { deleted: false };

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (gender) {
      filter.sex = gender;
    }

    const users = await User.find(filter)
      .select("-password -securityCode")
      .sort({ createdAt: -1 });

    // Get booking stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const bookingStats = await Invoice.aggregate([
          {
            $match: {
              userId: user._id,
              status: { $in: ["paid", "completed"] },
            },
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: "$totalPrice" },
              totalBookings: { $sum: 1 },
            },
          },
        ]);

        return {
          ...user.toObject(),
          totalSpent: bookingStats[0]?.totalSpent || 0,
          totalBookings: bookingStats[0]?.totalBookings || 0,
        };
      })
    );

    res.json({
      success: true,
      users: usersWithStats,
      total: usersWithStats.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xuất danh sách người dùng",
    });
  }
};
