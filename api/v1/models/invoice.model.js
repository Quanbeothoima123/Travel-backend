const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceCode: { type: String, unique: true }, // sẽ auto tạo ở backend

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
    },

    departureDate: { type: Date, required: true },

    seatLimit: { type: Number, required: true }, // lấy từ tourDetail

    seatFor: [
      {
        typeOfPersonId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TypeOfPerson",
          required: true,
        },
        quantity: { type: Number, required: true, min: 0 },
      },
    ],

    seatAddFor: [
      {
        typeOfPersonId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TypeOfPerson",
          required: true,
        },
        quantity: { type: Number, min: 0 },
        moneyMoreForOne: { type: Number, default: 0 },
      },
    ],

    totalPeople: { type: Number, required: true }, // frontend gửi hoặc backend tính

    discountedBase: { type: Number, required: true }, // từ tourDetail

    nameOfUser: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },

    province: { type: mongoose.Schema.Types.ObjectId, ref: "Province" },
    ward: { type: mongoose.Schema.Types.ObjectId, ref: "Ward" },

    note: { type: String },

    typeOfPayment: {
      type: String,
      enum: ["cash", "bank-transfer", "credit-card", "momo", "zalopay"],
      required: true,
    },

    transactionId: { type: String, default: null }, // nếu cash => null
    isPaid: { type: Boolean, default: false }, // cash -> false, momo -> true khi thành công

    totalPrice: { type: Number, required: true, min: 0 },

    datePayment: { type: Date, default: null }, // cash -> null, momo -> ngày thanh toán
    status: {
      type: String,
      enum: ["pending", "paid", "canceled", "refunded"],
      default: "pending",
    },
    tourStatus: {
      type: String,
      enum: ["not-started", "on-tour", "completed", "no-show"],
      default: "not-started",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminAccount",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", InvoiceSchema, "invoices");
