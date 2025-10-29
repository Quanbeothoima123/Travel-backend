const User = require("../../models/user.model");
const Tour = require("../../models/tour.model");
const Invoice = require("../../models/invoice.model");
const News = require("../../models/news.model");
const UserFavorite = require("../../models/user-favorite.model");

// [GET] /admin/dashboard/overview
module.exports.getOverview = async (req, res) => {
  try {
    const { dateRange = "30" } = req.query; // 7, 30, 90, 365
    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Tổng doanh thu (chỉ đơn đã thanh toán)
    const paidInvoices = await Invoice.aggregate([
      { $match: { isPaid: true, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = paidInvoices[0]?.total || 0;

    // 2. Doanh thu tiềm năng (đơn pending)
    const pendingInvoices = await Invoice.aggregate([
      { $match: { status: "pending", isPaid: false } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const potentialRevenue = pendingInvoices[0]?.total || 0;

    // 3. Tổng số người dùng
    const totalUsers = await User.countDocuments({ deleted: false });

    // 4. Users có giao dịch đã thanh toán
    const usersWithTransactions = await Invoice.distinct("userId", {
      isPaid: true,
      status: "paid",
      userId: { $ne: null },
    });
    const activeUsers = usersWithTransactions.length;

    // 5. Tỷ lệ chuyển đổi
    const conversionRate =
      totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0;

    // 6. Doanh thu theo thời gian (7 ngày gần nhất cho chart)
    const revenueByDate = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            isPaid: "$isPaid",
          },
          total: { $sum: "$totalPrice" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // 7. User mới trong khoảng thời gian
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate },
      deleted: false,
    });

    // 8. Tổng số đơn hàng
    const totalOrders = await Invoice.countDocuments();
    const paidOrders = await Invoice.countDocuments({
      isPaid: true,
      status: "paid",
    });

    res.json({
      code: 200,
      success: true,
      data: {
        kpis: {
          totalRevenue,
          potentialRevenue,
          totalUsers,
          activeUsers,
          conversionRate: parseFloat(conversionRate),
          newUsers,
          totalOrders,
          paidOrders,
        },
        revenueChart: revenueByDate,
      },
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/payment-methods
module.exports.getPaymentMethods = async (req, res) => {
  try {
    const paymentStats = await Invoice.aggregate([
      { $match: { isPaid: true, status: "paid" } },
      {
        $group: {
          _id: "$typeOfPayment",
          count: { $sum: 1 },
          total: { $sum: "$totalPrice" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      code: 200,
      success: true,
      data: paymentStats,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/top-tours
module.exports.getTopTours = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const topTours = await Invoice.aggregate([
      { $match: { isPaid: true, status: "paid" } },
      {
        $group: {
          _id: "$tourId",
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          totalPeople: { $sum: "$totalPeople" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "tours",
          localField: "_id",
          foreignField: "_id",
          as: "tourInfo",
        },
      },
      { $unwind: "$tourInfo" },
      {
        $project: {
          tourId: "$_id",
          title: "$tourInfo.title",
          thumbnail: "$tourInfo.thumbnail",
          prices: "$tourInfo.prices",
          discount: "$tourInfo.discount",
          totalBookings: 1,
          totalRevenue: 1,
          totalPeople: 1,
        },
      },
    ]);

    res.json({
      code: 200,
      success: true,
      data: topTours,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/top-customers
module.exports.getTopCustomers = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const topCustomers = await Invoice.aggregate([
      { $match: { isPaid: true, status: "paid", userId: { $ne: null } } },
      {
        $group: {
          _id: "$userId",
          totalSpent: { $sum: "$totalPrice" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "user",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          userId: "$_id",
          fullName: "$userInfo.fullName",
          email: "$userInfo.email",
          avatar: "$userInfo.avatar",
          phone: "$userInfo.phone",
          totalSpent: 1,
          totalOrders: 1,
        },
      },
    ]);

    // Phân loại khách hàng
    const customersWithTier = topCustomers.map((customer, index) => {
      let tier = "Bronze";
      if (index === 0) tier = "Gold";
      else if (index === 1) tier = "Silver";

      return { ...customer, tier };
    });

    res.json({
      code: 200,
      success: true,
      data: customersWithTier,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/user-analytics
module.exports.getUserAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ deleted: false });

    const usersWithTransactions = await Invoice.distinct("userId", {
      isPaid: true,
      status: "paid",
      userId: { $ne: null },
    });

    const activeUsersCount = usersWithTransactions.length;
    const inactiveUsersCount = totalUsers - activeUsersCount;

    // Users theo tháng (12 tháng gần nhất)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const usersByMonth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
          deleted: false,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.json({
      code: 200,
      success: true,
      data: {
        totalUsers,
        activeUsersCount,
        inactiveUsersCount,
        usersByMonth,
      },
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/latest-news
module.exports.getLatestNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const latestNews = await News.find({
      deleted: false,
      status: "published",
    })
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select(
        "title slug thumbnail excerpt views likes saves shares type publishedAt"
      )
      .lean();

    res.json({
      code: 200,
      success: true,
      data: latestNews,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/latest-tours
module.exports.getLatestTours = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const latestTours = await Tour.find({
      deleted: false,
      active: true,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("title thumbnail prices discount seats slug type tags")
      .lean();

    // Tính số chỗ đã đặt cho mỗi tour
    const toursWithBookings = await Promise.all(
      latestTours.map(async (tour) => {
        const bookings = await Invoice.aggregate([
          {
            $match: {
              tourId: tour._id,
              status: { $in: ["pending", "paid"] },
            },
          },
          {
            $group: {
              _id: null,
              totalBooked: { $sum: "$totalPeople" },
            },
          },
        ]);

        const bookedSeats = bookings[0]?.totalBooked || 0;
        const availableSeats = tour.seats - bookedSeats;
        const fillRate =
          tour.seats > 0 ? ((bookedSeats / tour.seats) * 100).toFixed(2) : 0;

        let status = "available";
        if (availableSeats === 0) status = "full";
        else if (availableSeats <= tour.seats * 0.2) status = "almost-full";

        return {
          ...tour,
          bookedSeats,
          availableSeats,
          fillRate: parseFloat(fillRate),
          status,
        };
      })
    );

    res.json({
      code: 200,
      success: true,
      data: toursWithBookings,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/recent-activities
module.exports.getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Lấy đơn hàng mới nhất
    const recentOrders = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) / 2)
      .populate("userId", "fullName avatar")
      .populate("tourId", "title")
      .select("invoiceCode totalPrice status createdAt userId tourId")
      .lean();

    // Lấy users mới
    const recentUsers = await User.find({ deleted: false })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) / 2)
      .select("fullName avatar email createdAt")
      .lean();

    // Kết hợp và sắp xếp theo thời gian
    const activities = [
      ...recentOrders.map((order) => ({
        type: "order",
        data: order,
        timestamp: order.createdAt,
      })),
      ...recentUsers.map((user) => ({
        type: "user",
        data: user,
        timestamp: user.createdAt,
      })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      code: 200,
      success: true,
      data: activities.slice(0, parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/tour-statistics
module.exports.getTourStatistics = async (req, res) => {
  try {
    // Thống kê tour theo status
    const tourStatusStats = await Invoice.aggregate([
      {
        $group: {
          _id: "$tourStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Tỷ lệ hoàn thành tour
    const completionStats = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$tourStatus", "completed"] }, 1, 0] },
          },
          noShow: {
            $sum: { $cond: [{ $eq: ["$tourStatus", "no-show"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = completionStats[0] || { total: 0, completed: 0, noShow: 0 };
    const completionRate =
      stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0;
    const noShowRate =
      stats.total > 0 ? ((stats.noShow / stats.total) * 100).toFixed(2) : 0;

    res.json({
      code: 200,
      success: true,
      data: {
        tourStatusStats,
        completionRate: parseFloat(completionRate),
        noShowRate: parseFloat(noShowRate),
      },
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};

// [GET] /admin/dashboard/revenue-metrics
module.exports.getRevenueMetrics = async (req, res) => {
  try {
    // Average Order Value (AOV)
    const aovStats = await Invoice.aggregate([
      { $match: { isPaid: true, status: "paid" } },
      {
        $group: {
          _id: null,
          averageOrderValue: { $avg: "$totalPrice" },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Revenue per User (RPU)
    const rpuStats = await Invoice.aggregate([
      { $match: { isPaid: true, status: "paid", userId: { $ne: null } } },
      {
        $group: {
          _id: "$userId",
          totalSpent: { $sum: "$totalPrice" },
        },
      },
      {
        $group: {
          _id: null,
          averageRevenuePerUser: { $avg: "$totalSpent" },
          totalUsers: { $sum: 1 },
        },
      },
    ]);

    const aov = aovStats[0] || {
      averageOrderValue: 0,
      totalOrders: 0,
      totalRevenue: 0,
    };
    const rpu = rpuStats[0] || { averageRevenuePerUser: 0, totalUsers: 0 };

    res.json({
      code: 200,
      success: true,
      data: {
        averageOrderValue: Math.round(aov.averageOrderValue),
        revenuePerUser: Math.round(rpu.averageRevenuePerUser),
        totalOrders: aov.totalOrders,
        totalRevenue: aov.totalRevenue,
        payingUsers: rpu.totalUsers,
      },
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message,
    });
  }
};
