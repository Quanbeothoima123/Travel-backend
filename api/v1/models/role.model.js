const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    }, // "Admin", "Manager", "Staff"
    value: {
      type: String,
      unique: true,
      trim: true,
    }, // "admin", "manager", "staff" (slug)
    description: {
      type: String,
    },
    permissions: [
      {
        type: String,
      },
    ], // ["products_view", "bookings_create"]
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      // Sửa từ deleteAt -> deletedAt (nhất quán)
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index
RoleSchema.index({ deleted: 1 });

const Role = mongoose.model("Role", RoleSchema, "roles");

module.exports = Role;
