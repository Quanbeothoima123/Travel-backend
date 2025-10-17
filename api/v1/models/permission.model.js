const mongoose = require("mongoose");

const PermissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    }, // "products_view", "bookings_create"
    displayName: {
      type: String,
      required: true,
    }, // "Xem sản phẩm", "Tạo đặt phòng"
    module: {
      type: String,
      required: true,
      index: true,
    }, // "products", "bookings", "customers"
    action: {
      type: String,
      required: true,
      enum: ["view", "create", "edit", "delete", "manage"],
    },
    description: {
      type: String,
    },
    order: {
      type: Number,
      default: 0,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh hơn
PermissionSchema.index({ module: 1, order: 1 });
PermissionSchema.index({ deleted: 1 });

const Permission = mongoose.model(
  "Permission",
  PermissionSchema,
  "permissions"
);
module.exports = Permission;
