const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    expireAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Tự động xóa sau khi hết hạn
    },
  },
  { timestamps: true }
);
const Otp = mongoose.model("Otp", otpSchema, "otp");
module.exports = Otp;
