const mongoose = require("mongoose");

const BusinessLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminAccount",
      required: true,
    },
    adminName: { type: String }, // Lưu luôn tên cho tiện tra cứu

    action: {
      type: String,
      enum: ["create", "update", "delete", "restore", "bulk_update"],
      required: true,
    },

    model: {
      type: String,
      enum: [
        "Tour",
        "TourCategory",
        "News",
        "NewsCategory",
        "Gallery",
        "GalleryCategory",
        "Hotel",
        "Province",
        "Vehicle",
        // Thêm các model khác trong tương lai
      ],
      required: true,
    },

    recordIds: [{ type: mongoose.Schema.Types.ObjectId }], // IDs của các bản ghi bị ảnh hưởng

    description: { type: String }, // Mô tả ngắn gọn

    details: { type: mongoose.Schema.Mixed }, // Chi tiết thay đổi (optional)

    ip: { type: String }, // IP của admin (optional)

    userAgent: { type: String }, // Trình duyệt (optional)
  },
  {
    timestamps: true, // Tự động thêm createdAt, updatedAt
  }
);

// Index để query nhanh
BusinessLogSchema.index({ adminId: 1, createdAt: -1 });
BusinessLogSchema.index({ model: 1, action: 1 });
BusinessLogSchema.index({ recordIds: 1 });

const BusinessLog = mongoose.model(
  "BusinessLog",
  BusinessLogSchema,
  "business-logs"
);

module.exports = BusinessLog;
