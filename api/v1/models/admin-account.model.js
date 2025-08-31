const mongoose = require("mongoose");

const AdminAccountSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String },
    role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
    },
    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const AdminAccount = mongoose.model(
  "AdminAccount",
  AdminAccountSchema,
  "admin-accounts"
);

module.exports = AdminAccount;
