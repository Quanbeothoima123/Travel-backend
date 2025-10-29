// controllers/admin/invoice.controller.js
const Invoice = require("../../models/invoice.model");
const Tour = require("../../models/tour.model");
const User = require("../../models/user.model");
const telegramBot = require("../../../../helpers/telegramBot");

// [GET] /api/v1/admin/invoice
// Lấy danh sách invoice với filter, search, sort, pagination
module.exports.index = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      invoiceCode,
      userId,
      tourTitle,
      categoryId,
      departPlaceId,
      typeOfPayment,
      status,
      tourStatus,
      fromDate,
      toDate,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    // Tìm theo mã hóa đơn
    if (invoiceCode && invoiceCode.trim()) {
      filter.invoiceCode = { $regex: invoiceCode.trim(), $options: "i" };
    }

    // Tìm theo userId
    if (userId && userId.trim()) {
      filter.userId = userId.trim();
    }

    // Tìm theo tên tour (phải join với Tour)
    let tourIds = [];
    if (tourTitle && tourTitle.trim()) {
      const tours = await Tour.find(
        { title: { $regex: tourTitle.trim(), $options: "i" } },
        "_id"
      ).lean();
      tourIds = tours.map((t) => t._id);

      if (tourIds.length > 0) {
        filter.tourId = { $in: tourIds };
      } else {
        // Không tìm thấy tour nào => trả về rỗng
        return res.json({
          invoices: [],
          totalPages: 0,
          totalItems: 0,
          totalRevenue: 0,
          totalBookings: 0,
        });
      }
    }

    // Lọc theo danh mục tour
    if (categoryId && categoryId.trim()) {
      const toursInCategory = await Tour.find(
        { categoryId: categoryId.trim() },
        "_id"
      ).lean();
      const categoryTourIds = toursInCategory.map((t) => t._id);

      if (categoryTourIds.length > 0) {
        if (filter.tourId && filter.tourId.$in) {
          // Giao của 2 điều kiện
          filter.tourId.$in = filter.tourId.$in.filter((id) =>
            categoryTourIds.some((catId) => catId.equals(id))
          );
        } else {
          filter.tourId = { $in: categoryTourIds };
        }
      } else {
        return res.json({
          invoices: [],
          totalPages: 0,
          totalItems: 0,
          totalRevenue: 0,
          totalBookings: 0,
        });
      }
    }

    // Lọc theo điểm khởi hành
    if (departPlaceId && departPlaceId.trim()) {
      const toursWithDepartPlace = await Tour.find(
        { departPlaceId: departPlaceId.trim() },
        "_id"
      ).lean();
      const departTourIds = toursWithDepartPlace.map((t) => t._id);

      if (departTourIds.length > 0) {
        if (filter.tourId && filter.tourId.$in) {
          filter.tourId.$in = filter.tourId.$in.filter((id) =>
            departTourIds.some((deptId) => deptId.equals(id))
          );
        } else {
          filter.tourId = { $in: departTourIds };
        }
      } else {
        return res.json({
          invoices: [],
          totalPages: 0,
          totalItems: 0,
          totalRevenue: 0,
          totalBookings: 0,
        });
      }
    }

    // Lọc theo phương thức thanh toán
    if (typeOfPayment && typeOfPayment.trim()) {
      filter.typeOfPayment = typeOfPayment.trim();
    }

    // Lọc theo trạng thái thanh toán
    if (status && status.trim()) {
      filter.status = status.trim();
    }

    // Lọc theo trạng thái tour
    if (tourStatus && tourStatus.trim()) {
      filter.tourStatus = tourStatus.trim();
    }

    // Lọc theo khoảng ngày (createdAt)
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }

    // Lọc theo khoảng giá
    if (minPrice || maxPrice) {
      filter.totalPrice = {};
      if (minPrice && !isNaN(minPrice)) {
        filter.totalPrice.$gte = Number(minPrice);
      }
      if (maxPrice && !isNaN(maxPrice)) {
        filter.totalPrice.$lte = Number(maxPrice);
      }
    }

    // Build sort object
    const sortObj = {};
    const allowedSortFields = ["createdAt", "totalPrice", "departureDate"];
    if (allowedSortFields.includes(sortBy)) {
      sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sortObj.createdAt = -1; // default
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Query
    const [invoices, totalItems] = await Promise.all([
      Invoice.find(filter)
        .populate("userId", "fullName email phone")
        .populate({
          path: "tourId",
          select: "title thumbnail slug departPlaceId",
          populate: {
            path: "departPlaceId",
            select: "name description slug",
          },
        })
        .populate("province", "name_with_type")
        .populate("ward", "name_with_type")
        .populate("createdBy", "fullName email")
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limitNum);

    // Tính toán thống kê
    const stats = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalPrice" },
          totalBookings: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = stats.length > 0 ? stats[0].totalRevenue : 0;
    const totalBookings = stats.length > 0 ? stats[0].totalBookings : 0;

    res.json({
      invoices,
      currentPage: pageNum,
      totalPages,
      totalItems,
      totalRevenue,
      totalBookings,
    });
  } catch (error) {
    console.error("Error in invoice.index:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hóa đơn",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/invoice/:id
// Lấy chi tiết một invoice
module.exports.detail = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate("userId", "fullName email phone avatar address")
      .populate({
        path: "tourId",
        select:
          "title thumbnail slug prices discount categoryId travelTimeId hotelId departPlaceId vehicleId",
        populate: [
          { path: "categoryId", select: "title slug" },
          { path: "travelTimeId", select: "name" },
          { path: "hotelId", select: "name star" },
          { path: "departPlaceId", select: "name" },
          { path: "vehicleId", select: "name" },
        ],
      })
      .populate("province", "name_with_type code")
      .populate("ward", "name_with_type code")
      .populate({
        path: "seatFor.typeOfPersonId",
        select: "name",
      })
      .populate({
        path: "seatAddFor.typeOfPersonId",
        select: "name",
      })
      .populate("createdBy", "fullName email phone")
      .lean();

    if (!invoice) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn",
      });
    }

    res.json({
      invoice,
    });
  } catch (error) {
    console.error("Error in invoice.detail:", error);
    res.status(500).json({
      message: "Lỗi khi lấy chi tiết hóa đơn",
      error: error.message,
    });
  }
};

// [POST] /api/v1/admin/invoice/create
// Tạo invoice mới (admin tạo cho khách)
module.exports.create = async (req, res) => {
  try {
    const {
      tourId,
      departureDate,
      seatLimit,
      seatFor,
      seatAddFor,
      totalPeople,
      discountedBase,
      nameOfUser,
      phoneNumber,
      email,
      address,
      province,
      ward,
      note,
      typeOfPayment,
      totalPrice,
      userId,
    } = req.body;

    // Validate required fields
    if (
      !tourId ||
      !departureDate ||
      !seatLimit ||
      !seatFor ||
      !totalPeople ||
      !nameOfUser ||
      !phoneNumber ||
      !email ||
      !address ||
      !typeOfPayment ||
      !totalPrice
    ) {
      return res.status(400).json({
        message: "Thiếu thông tin bắt buộc",
      });
    }

    // Generate invoice code
    const lastInvoice = await Invoice.findOne()
      .sort({ createdAt: -1 })
      .select("invoiceCode")
      .lean();

    let invoiceCode = "INV00001";
    if (lastInvoice && lastInvoice.invoiceCode) {
      const lastNumber = parseInt(lastInvoice.invoiceCode.replace("INV", ""));
      const newNumber = lastNumber + 1;
      invoiceCode = `INV${String(newNumber).padStart(5, "0")}`;
    }

    // Create invoice
    const newInvoice = new Invoice({
      invoiceCode,
      userId: userId || null,
      tourId,
      departureDate,
      seatLimit,
      seatFor,
      seatAddFor: seatAddFor || [],
      totalPeople,
      discountedBase: discountedBase || 0,
      nameOfUser,
      phoneNumber,
      email,
      address,
      province: province || null,
      ward: ward || null,
      note: note || "",
      typeOfPayment,
      totalPrice,
      status: "pending", // Luôn luôn là pending khi mới tạo
      isPaid: false,
      createdBy: req.adminId || null,
    });

    await newInvoice.save();

    // Lấy thông tin tour để gửi thông báo
    const tour = await Tour.findById(tourId).select("title").lean();

    // 🔔 GỬI THÔNG BÁO TELEGRAM - ĐƠN HÀNG MỚI (CHƯA THANH TOÁN)
    telegramBot
      .notifyNewOrder({
        invoiceCode: newInvoice.invoiceCode,
        nameOfUser: newInvoice.nameOfUser,
        phoneNumber: newInvoice.phoneNumber,
        email: newInvoice.email,
        totalPrice: newInvoice.totalPrice,
        totalPeople: newInvoice.totalPeople,
        tourTitle: tour?.title || "N/A",
        typeOfPayment: newInvoice.typeOfPayment,
        createdAt: newInvoice.createdAt,
      })
      .catch((err) => {
        console.error("⚠️ Lỗi gửi thông báo Telegram:", err.message);
      });

    res.status(201).json({
      message: "Tạo hóa đơn thành công",
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Error in invoice.create:", error);
    res.status(500).json({
      message: "Lỗi khi tạo hóa đơn",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/invoice/update-status/:id
// Cập nhật trạng thái thanh toán
module.exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId } = req.body;

    const allowedStatuses = ["pending", "paid", "canceled", "refunded"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Trạng thái không hợp lệ",
      });
    }

    // Lấy invoice cũ để so sánh trạng thái
    const oldInvoice = await Invoice.findById(id)
      .populate("tourId", "title")
      .lean();

    if (!oldInvoice) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn",
      });
    }

    const updateData = {
      status,
    };

    if (status === "paid") {
      updateData.isPaid = true;
      updateData.datePayment = new Date();
      if (transactionId) {
        updateData.transactionId = transactionId;
      }
    }

    const invoice = await Invoice.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    // 🔔 GỬI THÔNG BÁO TELEGRAM - THANH TOÁN THÀNH CÔNG
    // Chỉ gửi khi chuyển từ pending → paid
    if (status === "paid" && oldInvoice.status === "pending") {
      telegramBot
        .notifyPaymentSuccess({
          invoiceCode: invoice.invoiceCode,
          nameOfUser: invoice.nameOfUser,
          totalPrice: invoice.totalPrice,
          typeOfPayment: invoice.typeOfPayment,
          transactionId: invoice.transactionId,
          datePayment: invoice.datePayment,
        })
        .catch((err) => {
          console.error("⚠️ Lỗi gửi thông báo Telegram:", err.message);
        });
    }

    // 🔔 GỬI THÔNG BÁO KHI HUỶ ĐƠN
    if (status === "canceled") {
      telegramBot
        .broadcastMessage(
          `
⚠️ <b>ĐƠN HÀNG BỊ HUỶ</b>

📋 <b>Mã đơn:</b> ${invoice.invoiceCode}
👤 <b>Khách hàng:</b> ${invoice.nameOfUser}
💰 <b>Giá trị:</b> ${(invoice.totalPrice / 1000000).toFixed(1)} triệu VNĐ
📅 <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}

❌ Đơn hàng đã bị huỷ
      `.trim()
        )
        .catch((err) => {
          console.error("⚠️ Lỗi gửi thông báo Telegram:", err.message);
        });
    }

    // 🔔 GỬI THÔNG BÁO KHI HOÀN TIỀN
    if (status === "refunded") {
      telegramBot
        .broadcastMessage(
          `
💸 <b>HOÀN TIỀN</b>

📋 <b>Mã đơn:</b> ${invoice.invoiceCode}
👤 <b>Khách hàng:</b> ${invoice.nameOfUser}
💰 <b>Số tiền hoàn:</b> ${(invoice.totalPrice / 1000000).toFixed(1)} triệu VNĐ
📅 <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}

♻️ Đã hoàn tiền cho khách hàng
      `.trim()
        )
        .catch((err) => {
          console.error("⚠️ Lỗi gửi thông báo Telegram:", err.message);
        });
    }

    res.json({
      message: "Cập nhật trạng thái thành công",
      invoice,
    });
  } catch (error) {
    console.error("Error in invoice.updateStatus:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật trạng thái",
      error: error.message,
    });
  }
};

// [PATCH] /api/v1/admin/invoice/update-tour-status/:id
// Cập nhật trạng thái tour
module.exports.updateTourStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { tourStatus } = req.body;

    const allowedTourStatuses = [
      "not-started",
      "on-tour",
      "completed",
      "no-show",
    ];
    if (!allowedTourStatuses.includes(tourStatus)) {
      return res.status(400).json({
        message: "Trạng thái tour không hợp lệ",
      });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { tourStatus },
      { new: true }
    ).populate("tourId", "title");

    if (!invoice) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn",
      });
    }

    // 🔔 GỬI THÔNG BÁO TELEGRAM - THAY ĐỔI TRẠNG THÁI TOUR
    const statusEmoji = {
      "not-started": "⏳",
      "on-tour": "🚌",
      completed: "✅",
      "no-show": "❌",
    };

    const statusName = {
      "not-started": "Chưa bắt đầu",
      "on-tour": "Đang diễn ra",
      completed: "Hoàn thành",
      "no-show": "Khách vắng mặt",
    };

    telegramBot
      .broadcastMessage(
        `
${statusEmoji[tourStatus]} <b>CẬP NHẬT TRẠNG THÁI TOUR</b>

📋 <b>Mã đơn:</b> ${invoice.invoiceCode}
🎫 <b>Tour:</b> ${invoice.tourId?.title || "N/A"}
👤 <b>Khách hàng:</b> ${invoice.nameOfUser}

📊 <b>Trạng thái mới:</b> ${statusName[tourStatus]}
⏰ <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}
    `.trim()
      )
      .catch((err) => {
        console.error("⚠️ Lỗi gửi thông báo Telegram:", err.message);
      });

    res.json({
      message: "Cập nhật trạng thái tour thành công",
      invoice,
    });
  } catch (error) {
    console.error("Error in invoice.updateTourStatus:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật trạng thái tour",
      error: error.message,
    });
  }
};

// [DELETE] /api/v1/admin/invoice/cancel/:id
// Hủy booking (chỉ hủy được khi status = pending)
module.exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn",
      });
    }

    if (invoice.status !== "pending") {
      return res.status(400).json({
        message: "Chỉ có thể hủy booking ở trạng thái chờ xử lý",
      });
    }

    invoice.status = "canceled";
    if (reason) {
      invoice.note = invoice.note
        ? `${invoice.note}\n[Lý do hủy]: ${reason}`
        : `[Lý do hủy]: ${reason}`;
    }

    await invoice.save();

    // 🔔 GỬI THÔNG BÁO TELEGRAM - HUỶ BOOKING
    telegramBot
      .broadcastMessage(
        `
🚫 <b>HUỶ BOOKING</b>

📋 <b>Mã đơn:</b> ${invoice.invoiceCode}
👤 <b>Khách hàng:</b> ${invoice.nameOfUser}
💰 <b>Giá trị:</b> ${(invoice.totalPrice / 1000000).toFixed(1)} triệu VNĐ
${reason ? `📝 <b>Lý do:</b> ${reason}` : ""}
📅 <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}

❌ Booking đã bị huỷ
    `.trim()
      )
      .catch((err) => {
        console.error("⚠️ Lỗi gửi thông báo Telegram:", err.message);
      });

    res.json({
      message: "Hủy booking thành công",
      invoice,
    });
  } catch (error) {
    console.error("Error in invoice.cancel:", error);
    res.status(500).json({
      message: "Lỗi khi hủy booking",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/invoice/statistics
// Thống kê tổng quan
module.exports.statistics = async (req, res) => {
  try {
    const { fromDate, toDate, status, tourStatus } = req.query;

    const filter = {};

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }

    if (status) {
      filter.status = status;
    }

    if (tourStatus) {
      filter.tourStatus = tourStatus;
    }

    // Thống kê tổng
    const totalStats = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalPrice" },
          totalBookings: { $sum: 1 },
          totalPeople: { $sum: "$totalPeople" },
          avgPrice: { $avg: "$totalPrice" },
        },
      },
    ]);

    // Thống kê theo trạng thái
    const statusStats = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Thống kê theo phương thức thanh toán
    const paymentStats = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$typeOfPayment",
          count: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Top 5 tour được đặt nhiều nhất
    const topTours = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$tourId",
          count: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "tours",
          localField: "_id",
          foreignField: "_id",
          as: "tour",
        },
      },
      { $unwind: "$tour" },
      {
        $project: {
          tourTitle: "$tour.title",
          count: 1,
          revenue: 1,
        },
      },
    ]);

    res.json({
      total: totalStats[0] || {
        totalRevenue: 0,
        totalBookings: 0,
        totalPeople: 0,
        avgPrice: 0,
      },
      byStatus: statusStats,
      byPayment: paymentStats,
      topTours,
    });
  } catch (error) {
    console.error("Error in invoice.statistics:", error);
    res.status(500).json({
      message: "Lỗi khi lấy thống kê",
      error: error.message,
    });
  }
};

// [GET] /api/v1/admin/invoice/export
// Xuất dữ liệu Excel (trả về data để frontend xử lý)
module.exports.exportData = async (req, res) => {
  try {
    const filter = {};
    // Áp dụng các filter giống như index()
    // ... (copy logic filter từ index)

    const invoices = await Invoice.find(filter)
      .populate("userId", "fullName email phone")
      .populate("tourId", "title")
      .populate("province", "name_with_type")
      .populate("ward", "name_with_type")
      .sort({ createdAt: -1 })
      .lean();

    // Format data để export
    const exportData = invoices.map((inv, idx) => ({
      STT: idx + 1,
      "Mã hóa đơn": inv.invoiceCode,
      "Tên tour": inv.tourId?.title || "",
      "Tên khách hàng": inv.nameOfUser,
      "Số điện thoại": inv.phoneNumber,
      Email: inv.email,
      "Ngày đặt": new Date(inv.createdAt).toLocaleDateString("vi-VN"),
      "Ngày khởi hành": new Date(inv.departureDate).toLocaleDateString("vi-VN"),
      "Số lượng ghế": inv.totalPeople,
      "Tổng tiền": inv.totalPrice,
      "Phương thức thanh toán": inv.typeOfPayment,
      "Trạng thái thanh toán": inv.status,
      "Trạng thái tour": inv.tourStatus,
    }));

    res.json({
      data: exportData,
    });
  } catch (error) {
    console.error("Error in invoice.exportData:", error);
    res.status(500).json({
      message: "Lỗi khi xuất dữ liệu",
      error: error.message,
    });
  }
};
