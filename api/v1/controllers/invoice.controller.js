const Tour = require("../models/tour.model");
const generateInvoiceCode = require("../../../utils/genCodeInvoice");
const Invoice = require("../models/invoice.model");
// [POST] /api/v1/invoice
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env;

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

    if (typeOfPayment !== "cash") {
      // giả sử sau này tích hợp momo -> set ở đây
      transactionId = "TEMP_" + Date.now();
      isPaid = true;
      datePayment = new Date();
    }

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
      message: "Cảm ơn đã đã đặt lịch, chúc bạn sớm có một chuyến đi vui vẻ!",
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ message: "Có gì đó sai sai!" });
  }
};
