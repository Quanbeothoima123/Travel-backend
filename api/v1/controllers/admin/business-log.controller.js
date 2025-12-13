const BusinessLog = require("../../models/business-log.model");
const AdminAccount = require("../../models/admin-account.model");

const businessLogController = {
  // ✅ Lấy danh sách logs với filter và phân trang
  getAllLogs: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        model,
        action,
        adminId,
        adminName,
        startDate,
        endDate,
        search,
      } = req.query;

      const query = {};

      // Filter theo model
      if (model) {
        query.model = model;
      }

      // Filter theo action
      if (action) {
        query.action = action;
      }

      // Filter theo adminId
      if (adminId) {
        query.adminId = adminId;
      }

      // Filter theo adminName (tìm kiếm gần đúng)
      if (adminName) {
        query.adminName = { $regex: adminName, $options: "i" };
      }

      // Filter theo thời gian
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      // Tìm kiếm trong description
      if (search) {
        query.description = { $regex: search, $options: "i" };
      }

      // Phân trang
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Đếm tổng số logs
      const totalLogs = await BusinessLog.countDocuments(query);

      // Lấy logs
      const logs = await BusinessLog.find(query)
        .populate("adminId", "fullName email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Format dữ liệu trả về
      const formattedLogs = logs.map((log) => ({
        _id: log._id,
        adminId: log.adminId?._id || null,
        adminName: log.adminName || log.adminId?.fullName || "Unknown",
        adminEmail: log.adminId?.email || null,
        adminAvatar: log.adminId?.avatar || null,
        action: log.action,
        model: log.model,
        recordIds: log.recordIds,
        description: log.description,
        details: log.details,
        ip: log.ip,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      }));

      res.status(200).json({
        success: true,
        data: formattedLogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalLogs / parseInt(limit)),
          totalLogs,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Get all logs error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách logs",
        error: error.message,
      });
    }
  },

  // ✅ Lấy chi tiết một log
  getLogById: async (req, res) => {
    try {
      const { id } = req.params;

      const log = await BusinessLog.findById(id)
        .populate("adminId", "fullName email avatar role_id")
        .lean();

      if (!log) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy log",
        });
      }

      res.status(200).json({
        success: true,
        data: log,
      });
    } catch (error) {
      console.error("Get log by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy chi tiết log",
        error: error.message,
      });
    }
  },

  // ✅ Lấy thống kê logs
  getLogStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const matchQuery = {};
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

      // Thống kê theo model
      const modelStats = await BusinessLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$model",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      // Thống kê theo action
      const actionStats = await BusinessLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      // Thống kê theo admin
      const adminStats = await BusinessLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$adminId",
            adminName: { $first: "$adminName" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      // Tổng số logs
      const totalLogs = await BusinessLog.countDocuments(matchQuery);

      res.status(200).json({
        success: true,
        data: {
          totalLogs,
          byModel: modelStats,
          byAction: actionStats,
          topAdmins: adminStats,
        },
      });
    } catch (error) {
      console.error("Get log stats error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê logs",
        error: error.message,
      });
    }
  },

  // ✅ Lấy danh sách models có sẵn
  getAvailableModels: async (req, res) => {
    try {
      const models = await BusinessLog.distinct("model");
      res.status(200).json({
        success: true,
        data: models.sort(),
      });
    } catch (error) {
      console.error("Get available models error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách models",
        error: error.message,
      });
    }
  },

  // ✅ Lấy danh sách actions có sẵn
  getAvailableActions: async (req, res) => {
    try {
      const actions = await BusinessLog.distinct("action");
      res.status(200).json({
        success: true,
        data: actions.sort(),
      });
    } catch (error) {
      console.error("Get available actions error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách actions",
        error: error.message,
      });
    }
  },

  // ✅ Lấy danh sách admins đã có log
  getAvailableAdmins: async (req, res) => {
    try {
      const admins = await BusinessLog.aggregate([
        {
          $group: {
            _id: "$adminId",
            adminName: { $first: "$adminName" },
          },
        },
        {
          $lookup: {
            from: "admin-accounts",
            localField: "_id",
            foreignField: "_id",
            as: "adminInfo",
          },
        },
        {
          $project: {
            _id: 1,
            adminName: {
              $ifNull: [
                { $arrayElemAt: ["$adminInfo.fullName", 0] },
                "$adminName",
              ],
            },
            email: { $arrayElemAt: ["$adminInfo.email", 0] },
          },
        },
        { $sort: { adminName: 1 } },
      ]);

      res.status(200).json({
        success: true,
        data: admins,
      });
    } catch (error) {
      console.error("Get available admins error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách admins",
        error: error.message,
      });
    }
  },

  // ✅ Xóa logs cũ (chỉ admin cao cấp)
  deleteOldLogs: async (req, res) => {
    try {
      const { days = 90 } = req.body;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await BusinessLog.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      res.status(200).json({
        success: true,
        message: `Đã xóa ${result.deletedCount} logs cũ hơn ${days} ngày`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error("Delete old logs error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa logs",
        error: error.message,
      });
    }
  },
};

module.exports = businessLogController;
