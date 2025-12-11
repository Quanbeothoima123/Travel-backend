const mongoose = require("mongoose");

const BusinessLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminAccount",
      required: true,
    },
    adminName: { type: String },

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
      ],
      required: true,
    },

    recordIds: [{ type: mongoose.Schema.Types.ObjectId }],
    description: { type: String },
    details: mongoose.Schema.Types.Mixed, // ✅ ĐÃ SỬA
    ip: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: true,
  }
);

BusinessLogSchema.index({ adminId: 1, createdAt: -1 });
BusinessLogSchema.index({ model: 1, action: 1 });
BusinessLogSchema.index({ recordIds: 1 });

const BusinessLog = mongoose.model(
  "BusinessLog",
  BusinessLogSchema,
  "business-logs"
);

module.exports = BusinessLog;
