// models/refresh-token-user.model.js
const mongoose = require("mongoose");

const refreshTokenUserSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Tự động xóa token hết hạn
refreshTokenUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  "RefreshTokenUser",
  refreshTokenUserSchema,
  "refresh-tokens-user"
);
