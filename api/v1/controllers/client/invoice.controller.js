const Tour = require("../../models/tour.model");
const generateInvoiceCode = require("../../../../utils/genCodeInvoice");
const Invoice = require("../../models/invoice.model");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createMomoPayment } = require("../../../../utils/momo");
const { JWT_SECRET } = process.env;
const emailService = require("../../../../services/emailService");
const TourCategory = require("../../models/tour-category.model");
// [POST] /api/v1/invoices
module.exports.createInvoice = async (req, res) => {
  try {
    const {
      tourId,
      departureDate,
      seatFor,
      seatAddFor,
      nameOfUser,
      phoneNumber,
      email,
      address,
      province,
      ward,
      note,
      typeOfPayment,
      totalPrice,
    } = req.body;

    // Lấy userId từ JWT cookie
    let userId = null;
    const token = req.cookies?.authToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        userId = null; // token không hợp lệ
      }
    }

    // Lấy thông tin tour
    const tour = await Tour.findById(tourId);
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    // seatLimit = số chỗ tiêu chuẩn trong tour
    const seatLimit = tour.seats;

    // discountedBase = prices - discount
    const discountedBase =
      tour.discount > 0 ? tour.prices - tour.discount : tour.prices;

    // tính tổng số khách
    const totalPeople =
      (seatFor?.reduce((sum, s) => sum + s.quantity, 0) || 0) +
      (seatAddFor?.reduce((sum, s) => sum + s.quantity, 0) || 0);

    // set transactionId, datePayment, isPaid dựa theo typeOfPayment
    let transactionId = null;
    let isPaid = false;
    let datePayment = null;
    // tạo mã hóa đơn (backend tự sinh)
    const invoiceCode = generateInvoiceCode();

    const newInvoice = new Invoice({
      invoiceCode,
      userId,
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
      transactionId,
      isPaid,
      totalPrice,
      datePayment,
      status: typeOfPayment === "cash" ? "pending" : "paid",
      createdBy: null,
    });

    await newInvoice.save();

    res.status(201).json({
      success: true,
      message: "Cảm ơn đã đã đặt lịch, chúc bạn sớm có một chuyến đi vui vẻ!",
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ message: "Có gì đó sai sai!" });
  }
};

module.exports.payWithMomo = async (req, res) => {
  try {
    const {
      tourId,
      departureDate,
      seatFor,
      seatAddFor,
      nameOfUser,
      phoneNumber,
      email,
      address,
      province,
      ward,
      note,
      totalPrice,
    } = req.body;

    // lấy userId từ token
    let userId = null;
    const token = req.cookies?.authToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        userId = null;
      }
    }

    const tour = await Tour.findById(tourId);
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    const seatLimit = tour.seats;
    const discountedBase =
      tour.discount > 0 ? tour.prices - tour.discount : tour.prices;

    const totalPeople =
      (seatFor?.reduce((sum, s) => sum + s.quantity, 0) || 0) +
      (seatAddFor?.reduce((sum, s) => sum + s.quantity, 0) || 0);

    // tạo hóa đơn trước (pending)
    const invoiceCode = "INV" + Date.now();

    const invoice = new Invoice({
      invoiceCode,
      userId,
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
      typeOfPayment: "momo",
      transactionId: null,
      isPaid: false,
      totalPrice,
      datePayment: null,
      status: "pending",
      createdBy: null,
    });

    await invoice.save();

    // gọi MoMo
    const momoRes = await createMomoPayment({
      amount: totalPrice,
      orderId: invoice._id.toString(),
      orderInfo: `Thanh toán đơn hàng ${invoiceCode}`,
      redirectUrl: "http://localhost:3000/payment/momo/result",
      ipnUrl: "https://3f953d48ebe6.ngrok-free.app/api/v1/invoice/momo-ipn",
    });

    if (momoRes?.payUrl) {
      return res.json({ payUrl: momoRes.payUrl, invoiceId: invoice._id });
    } else {
      return res
        .status(400)
        .json({ message: "Không tạo được giao dịch MoMo", momoRes });
    }
  } catch (error) {
    console.error("Error payWithMomo:", error);
    res.status(500).json({ message: "Có lỗi khi thanh toán MoMo" });
  }
};

// controllers/invoiceController.js
module.exports.momoIPN = async (req, res) => {
  try {
    console.log(req.body);
    const { orderId, resultCode, transId } = req.body;

    const invoice = await Invoice.findById(orderId);
    if (!invoice) return res.status(404).end();

    if (resultCode === 0) {
      invoice.status = "paid";
      invoice.isPaid = true;
      invoice.transactionId = transId;
      invoice.datePayment = new Date();
      await invoice.save();
    } else {
      invoice.status = "canceled";
      await invoice.save();
    }

    res.json({ message: "IPN received" });
  } catch (error) {
    console.error("IPN error:", error);
    res.status(500).end();
  }
};

module.exports.getById = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({ message: "Invalid invoiceId" });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate("userId", "fullName email phoneNumber")
      .populate("tourId", "title thumbnail slug")
      .populate("seatFor.typeOfPersonId", "name")
      .populate("seatAddFor.typeOfPersonId", "name")
      .populate("province", "name_with_type")
      .populate("ward", "name_with_type");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json(invoice);
  } catch (error) {
    console.error("Error in getById:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/v1/invoice/code/:invoiceCode
module.exports.getByCode = async (req, res) => {
  try {
    const { invoiceCode } = req.params;
    const invoice = await Invoice.findOne({ invoiceCode })
      .populate("userId", "fullName email phoneNumber")
      .populate("tourId", "title thumbnail")
      .populate("seatFor.typeOfPersonId", "name")
      .populate("seatAddFor.typeOfPersonId", "name")
      .populate("province", "name_with_type")
      .populate("ward", "name_with_type");

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const buildFullAddress = (address, wardName, provinceName) => {
  const parts = [address];
  if (wardName) parts.push(wardName);
  if (provinceName) parts.push(provinceName);
  return parts.filter(Boolean).join(", ");
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
};

const getPaymentMethodText = (method) => {
  const methods = {
    cash: "Tiền mặt",
    "bank-transfer": "Chuyển khoản ngân hàng",
    "credit-card": "Thẻ tín dụng",
    momo: "MoMo",
    zalopay: "ZaloPay",
  };
  return methods[method] || method;
};

const getStatusText = (status) => {
  const statuses = {
    pending: "Chờ thanh toán",
    paid: "Đã thanh toán",
    canceled: "Đã hủy",
    refunded: "Đã hoàn tiền",
  };
  return statuses[status] || status;
};

const getInvoiceWithDetails = async (orderId) => {
  return await Invoice.findById(orderId)
    .populate({
      path: "tourId",
      select:
        "title thumbnail travelTimeId hotelId departPlaces vehicleId frequency",
      populate: [
        { path: "travelTimeId", select: "day night" },
        { path: "hotelId", select: "name star" },
        { path: "vehicleId", select: "name" },
        { path: "frequency", select: "title" },
      ],
    })
    .populate({ path: "seatFor.typeOfPersonId", select: "name" })
    .populate({ path: "seatAddFor.typeOfPersonId", select: "name" })
    .populate({ path: "province", select: "name_with_type" })
    .populate({ path: "ward", select: "name_with_type" });
};

const processInvoiceData = (invoice) => {
  const fullAddress = buildFullAddress(
    invoice.address,
    invoice.ward?.name_with_type,
    invoice.province?.name_with_type
  );

  const seatForWithPrice = invoice.seatFor.map((seat) => ({
    typeOfPersonName: seat.typeOfPersonId?.name || "N/A",
    quantity: seat.quantity,
    price: invoice.discountedBase,
    typeOfPersonId: seat.typeOfPersonId?._id,
  }));

  const seatAddForWithPrice = invoice.seatAddFor.map((seat) => ({
    typeOfPersonName: seat.typeOfPersonId?.name || "N/A",
    quantity: seat.quantity,
    moneyMoreForOne: seat.moneyMoreForOne,
    typeOfPersonId: seat.typeOfPersonId?._id,
  }));

  return {
    invoiceCode: invoice.invoiceCode,
    nameOfUser: invoice.nameOfUser,
    email: invoice.email,
    phoneNumber: invoice.phoneNumber,
    fullAddress,
    tourTitle: invoice.tourId?.title || "N/A",
    departureDate: invoice.departureDate,
    totalPeople: invoice.totalPeople,
    totalPrice: invoice.totalPrice,
    typeOfPayment: invoice.typeOfPayment,
    status: invoice.status,
    seatFor: seatForWithPrice,
    seatAddFor: seatAddForWithPrice,
    note: invoice.note,
  };
};

const generateInvoiceEmailTemplate = (data) => {
  const {
    invoiceCode,
    nameOfUser,
    email,
    phoneNumber,
    fullAddress,
    tourTitle,
    departureDate,
    totalPeople,
    totalPrice,
    typeOfPayment,
    status,
    seatFor,
    seatAddFor,
    note,
  } = data;

  return `
    <html>
      <body>
        <h1>HÓA ĐƠN TOUR DU LỊCH</h1>
        <p>Mã hóa đơn: ${invoiceCode}</p>
        <p>Khách hàng: ${nameOfUser} - ${email} - ${phoneNumber}</p>
        <p>Địa chỉ: ${fullAddress}</p>
        <p>Tour: ${tourTitle}</p>
        <p>Ngày khởi hành: ${formatDate(departureDate)}</p>
        <p>Tổng số người: ${totalPeople}</p>
        <p>Trạng thái: ${getStatusText(status)}</p>
        <p>Thanh toán: ${getPaymentMethodText(typeOfPayment)}</p>
        <p>Tổng tiền: ${formatCurrency(totalPrice)}</p>
        ${note ? `<p>Ghi chú: ${note}</p>` : ""}
        <h3>Chi tiết hành khách:</h3>
        <ul>
          ${seatFor
            .map(
              (s) =>
                `<li>${s.typeOfPersonName}: ${s.quantity} x ${formatCurrency(
                  s.price
                )}</li>`
            )
            .join("")}
          ${seatAddFor
            .map(
              (s) =>
                `<li>${s.typeOfPersonName} (Phụ thu): ${
                  s.quantity
                } x ${formatCurrency(s.moneyMoreForOne)}</li>`
            )
            .join("")}
        </ul>
      </body>
    </html>
  `;
};

module.exports.sendInvoiceEmail = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu invoiceId trong query params",
      });
    }

    const invoice = await getInvoiceWithDetails(invoiceId);

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    const emailData = processInvoiceData(invoice);
    const htmlContent = generateInvoiceEmailTemplate(emailData);
    const subject = `🎫 Hóa đơn tour ${emailData.tourTitle} - ${emailData.invoiceCode}`;

    const emailResult = await emailService.sendEmail(
      invoice.email,
      subject,
      htmlContent
    );

    if (emailResult.success) {
      return res.status(200).json({
        success: true,
        message: `Đã gửi hóa đơn đến ${invoice.email}`,
        data: {
          messageId: emailResult.messageId,
          invoiceCode: invoice.invoiceCode,
        },
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: emailResult.message });
    }
  } catch (error) {
    console.error("❌ Error sendInvoiceEmail:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi email hóa đơn",
    });
  }
};

// GET /api/v1/invoice?typeOfPayment=cash&page=1&limit=10
module.exports.getInvoices = async (req, res) => {
  try {
    // 1. Lấy userId từ token
    const authToken = req.cookies.authToken;
    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập lại.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc hết hạn.",
      });
    }

    const currentUserId = decoded.userId;

    // 2. Params lọc
    const {
      typeOfPayment,
      status,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      search,
      searchTour,
      categoryId,
      tourType,
      departPlaceId,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // 3. Filter Invoice
    const filter = { userId: new mongoose.Types.ObjectId(currentUserId) };

    if (typeOfPayment) filter.typeOfPayment = typeOfPayment;
    if (status) filter.status = status;

    if (minPrice || maxPrice) {
      filter.totalPrice = {};
      if (minPrice) filter.totalPrice.$gte = Number(minPrice);
      if (maxPrice) filter.totalPrice.$lte = Number(maxPrice);
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = d;
      }
    }

    if (search) {
      filter.$or = [
        { invoiceCode: { $regex: search, $options: "i" } },
        { nameOfUser: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // 4. Chuẩn bị match cho tourId
    let categoryIds = null;
    if (categoryId) {
      const descendantIds = await getAllDescendantIds(TourCategory, categoryId);
      categoryIds = [categoryId, ...descendantIds];
    }

    const tourMatch = {
      ...(categoryIds && {
        categoryId: {
          $in: categoryIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      }),
      ...(tourType && { type: tourType }),
      ...(searchTour && { title: { $regex: searchTour, $options: "i" } }),
      ...(departPlaceId && {
        departPlaceId: new mongoose.Types.ObjectId(departPlaceId),
      }),
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // 5. Aggregate query
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "tours",
          localField: "tourId",
          foreignField: "_id",
          as: "tourId",
          pipeline: [
            { $match: tourMatch },
            {
              $project: {
                _id: 1,
                title: 1,
                thumbnail: 1,
                slug: 1,
                type: 1,
                categoryId: 1,
                departPlaceId: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$tourId" }, // loại bỏ invoice không có tour
    ];

    // 6. Copy pipeline để đếm tổng
    const countPipeline = [...pipeline, { $count: "total" }];

    const totalResult = await Invoice.aggregate(countPipeline);
    const totalDocuments = totalResult.length > 0 ? totalResult[0].total : 0;
    const totalPages = Math.ceil(totalDocuments / limitNum);

    // 7. Thêm sort + pagination
    pipeline.push({ $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } });
    pipeline.push({ $skip: (pageNum - 1) * limitNum });
    pipeline.push({ $limit: limitNum });

    const invoices = await Invoice.aggregate(pipeline);

    // 8. Trả về kết quả
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách hóa đơn thành công",
      data: {
        invoices,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalDocuments,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
      },
    });
  } catch (err) {
    console.error("Error in getInvoices:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: err.message,
    });
  }
};

// GET /api/v1/invoice/statistics - Thống kê tổng quan
module.exports.getInvoiceStatistics = async (req, res) => {
  try {
    const { startDate, endDate, typeOfPayment } = req.query;

    // Tạo filter cho thời gian
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Filter theo payment type nếu có
    const paymentFilter = typeOfPayment ? { typeOfPayment } : {};

    const matchFilter = { ...dateFilter, ...paymentFilter };

    // Thống kê tổng quan
    const overallStats = await Invoice.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          totalPeople: { $sum: "$totalPeople" },
          avgOrderValue: { $avg: "$totalPrice" },
        },
      },
    ]);

    // Thống kê theo status
    const statusStats = await Invoice.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Thống kê theo payment type
    const paymentStats = await Invoice.aggregate([
      { $match: dateFilter }, // Chỉ filter theo ngày, không filter payment type
      {
        $group: {
          _id: "$typeOfPayment",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Thống kê theo tháng (12 tháng gần nhất)
    const monthlyStats = await Invoice.aggregate([
      {
        $match: {
          ...paymentFilter,
          createdAt: {
            $gte: new Date(
              new Date().setFullYear(new Date().getFullYear() - 1)
            ),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalPrice" },
          totalPeople: { $sum: "$totalPeople" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Lấy thống kê thành công",
      data: {
        overall: overallStats[0] || {
          totalInvoices: 0,
          totalRevenue: 0,
          totalPeople: 0,
          avgOrderValue: 0,
        },
        byStatus: statusStats,
        byPaymentType: paymentStats,
        monthly: monthlyStats,
        filters: {
          startDate,
          endDate,
          typeOfPayment,
        },
      },
    });
  } catch (error) {
    console.error("Error in getInvoiceStatistics:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thống kê",
      error: error.message,
    });
  }
};

// PATCH /api/v1/invoice/:id/status - Cập nhật status của invoice
module.exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    // Validate status
    const validStatuses = ["pending", "paid", "canceled", "refunded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const updateData = { status };

    // Nếu status là paid, cập nhật datePayment
    if (status === "paid") {
      updateData.datePayment = new Date();
      updateData.isPaid = true;
    }

    // Thêm note nếu có
    if (note) {
      updateData.note = note;
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("tourId", "title")
      .populate("userId", "fullName email");

    if (!updatedInvoice) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Cập nhật trạng thái hóa đơn thành ${status} thành công`,
      data: updatedInvoice,
    });
  } catch (error) {
    console.error("Error in updateInvoiceStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái hóa đơn",
      error: error.message,
    });
  }
};
