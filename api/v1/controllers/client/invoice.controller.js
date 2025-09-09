const Tour = require("../../models/tour.model");
const generateInvoiceCode = require("../../../../utils/genCodeInvoice");
const Invoice = require("../../models/invoice.model");
const { createMomoPayment } = require("../../../../utils/momo");
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
      ipnUrl: "https://3f953d48ebe6.ngrok-free.app/api/v1/momo-ipn",
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
