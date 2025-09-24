const mongoose = require("mongoose");

const UserFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    enum: ["article", "tour", "video", "news"],
    required: true,
  },

  createdAt: { type: Date, default: Date.now },
});

// 1 user chỉ favorite 1 lần cho 1 content
UserFavoriteSchema.index(
  { userId: 1, targetId: 1, targetType: 1 },
  { unique: true }
);

const UserFavorite = mongoose.model(
  "UserFavorite",
  UserFavoriteSchema,
  "user-favorite"
);
module.exports = UserFavorite;
