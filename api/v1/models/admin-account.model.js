const mongoose = require("mongoose");

const AdminAccountSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // Tự động chuyển thành chữ thường
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    avatar: {
      type: String,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true, // NÊN BẮT BUỘC để mọi account đều có role
    },
    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      // THÊM trường này để nhất quán
      type: Date,
      default: null,
    },
    lastLogin: {
      // THÊM: Theo dõi lần đăng nhập cuối
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index
AdminAccountSchema.index({ email: 1 });
AdminAccountSchema.index({ role_id: 1 });
AdminAccountSchema.index({ deleted: 1 });

const AdminAccount = mongoose.model(
  "AdminAccount",
  AdminAccountSchema,
  "admin-accounts"
);

module.exports = AdminAccount;
