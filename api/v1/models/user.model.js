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
    status: {
      type: String,
      default: "initial",
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", UserSchema, "user");
module.exports = User;
