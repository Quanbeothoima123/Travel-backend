// ========================================
// models/nickname.model.js
// ========================================
const mongoose = require("mongoose");
const NicknameSchema = new mongoose.Schema(
  {
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    forUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    nickname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Mỗi user chỉ set 1 nickname cho 1 người
NicknameSchema.index({ setBy: 1, forUser: 1 }, { unique: true });
NicknameSchema.index({ setBy: 1 });

const Nickname = mongoose.model("Nickname", NicknameSchema, "nicknames");
module.exports = Nickname;
