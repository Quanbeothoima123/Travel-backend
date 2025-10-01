const mongoose = require("mongoose");

const ShortSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500, // mô tả ngắn gọn
    },
    videoUrl: {
      type: String,
      required: false, // ← Sửa thành false
      default: "", // Cho phép rỗng khi đang xử lý
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "createdByType", // tham chiếu động
    },
    createdByType: {
      type: String,
      enum: ["User", "AdminAccount"], // phân biệt user hay admin
      default: "User",
    },
    province: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Province",
    },
    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
    },
    placeName: {
      type: String, // tên địa điểm cụ thể
      trim: true,
    },
    googleMap: {
      type: String, // link Google Maps (có thể chứa tọa độ hoặc share link)
      trim: true,
    },
    tags: [
      {
        type: String, // có thể nâng cấp sau thành ref riêng
        trim: true,
      },
    ],

    // 📊 Thống kê
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "deleted"],
      default: "inactive", // Mặc định inactive khi đang xử lý
    },
    deletedAt: Date,
  },
  {
    timestamps: true, // tự động có createdAt, updatedAt
  }
);

const Short = mongoose.model("Short", ShortSchema, "shorts");
module.exports = Short;
