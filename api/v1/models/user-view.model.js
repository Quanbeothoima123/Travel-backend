const mongoose = require("mongoose");

const UserViewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // có thể null nếu guest
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    enum: ["article", "tour", "video", "gallery"],
    required: true,
  },

  ip: { type: String },
  userAgent: { type: String },

  createdAt: { type: Date, default: Date.now },
});

UserViewSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });

const UserView = mongoose.model("UserView", UserViewSchema, "user-view");
module.exports = UserView;
