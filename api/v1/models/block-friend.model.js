// ========================================
// models/block.model.js
// ========================================
const mongoose = require("mongoose");
const BlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Index unique
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
BlockSchema.index({ blocker: 1 });
BlockSchema.index({ blocked: 1 });

const Block = mongoose.model("Block", BlockSchema, "block-friend");
module.exports = Block;
