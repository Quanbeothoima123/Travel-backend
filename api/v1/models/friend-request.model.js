// ========================================
// models/friendRequest.model.js
// ========================================
const mongoose = require("mongoose");
const FriendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      maxlength: 300,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "canceled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Index unique để tránh gửi nhiều lần
FriendRequestSchema.index({ from: 1, to: 1 }, { unique: true });
FriendRequestSchema.index({ from: 1 });
FriendRequestSchema.index({ to: 1 });
FriendRequestSchema.index({ status: 1 });

const FriendRequest = mongoose.model(
  "FriendRequest",
  FriendRequestSchema,
  "friend-requests"
);
module.exports = FriendRequest;
