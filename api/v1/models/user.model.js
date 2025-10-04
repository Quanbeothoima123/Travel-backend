const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: String,
    birthDay: Date,
    sex: String,
    phone: String,
    email: String,
    password: String,
    avatar: String,
    address: String,
    ward: { type: mongoose.Schema.Types.ObjectId, ref: "Ward" },
    province: { type: mongoose.Schema.Types.ObjectId, ref: "Province" },

    userName: String,
    isAnonymous: {
      type: Boolean,
      createAt: { type: Date, default: Date.now },
    },

    customName: { type: String }, // 🔹 tên hiển thị công khai, người khác thấy đầu tiên
    // 🔹 Biệt danh giữa hai người
    nicknames: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        nickname: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 🔹 Danh sách bạn bè
    friends: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 🔹 Lời mời kết bạn đã gửi (kết bạn đi)
    friendRequestsSent: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        message: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 🔹 Lời mời kết bạn đã nhận (kết bạn đến)
    friendRequestsReceived: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        message: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 🔹 Người dùng bị chặn
    blockedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 🔹 Mã bảo mật 6 chữ số (ví dụ bảo vệ chat)
    securityCode: {
      type: String,
      minlength: 6,
      maxlength: 6,
    },

    // 🔹 Trạng thái & xóa mềm
    status: { type: String, default: "initial" },
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", UserSchema, "user");
module.exports = User;
