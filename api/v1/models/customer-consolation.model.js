const mongoose = require("mongoose");

const CustomerConsolationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  tourId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tour",
    default: null,
  },
  phoneNumber: { type: String, required: true },
  requestCount: { type: Number, default: 1 },
  consultedCount: { type: Number, default: 0 },
  isBlacklisted: { type: Boolean, default: false },
  CreatedAt_first: { type: Date, default: Date.now },
  UpdateAt: { type: Date, default: Date.now },
});

const CustomerConsolation = mongoose.model(
  "CustomerConsolation",
  CustomerConsolationSchema,
  "customer-consolations"
);

module.exports = CustomerConsolation;
