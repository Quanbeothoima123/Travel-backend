// models/user.model.js
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
    customName: String, // Tên hiển thị công khai
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    securityCode: {
      type: String,
      minlength: 6,
      maxlength: 6,
    },

    status: { type: String, default: "initial" },
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastOnline: {
      type: Date,
      default: Date.now,
    },
  },

  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ userName: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ email: 1 });

const User = mongoose.model("User", UserSchema, "user");
module.exports = User;
