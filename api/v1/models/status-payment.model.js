const mongoose = require("mongoose");

const StatusPaymentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
  },
  {
    timestamps: true,
  }
);

const StatusPayment = mongoose.model(
  "StatusPayment",
  StatusPaymentSchema,
  "status-payment"
);

module.exports = StatusPayment;
