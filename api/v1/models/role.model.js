const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    value: { type: String },
    description: { type: String },
    permissions: [{ type: String }],
    deleted: { type: Boolean, default: false },
    deleteAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

const Role = mongoose.model("Role", RoleSchema, "roles");

module.exports = Role;
