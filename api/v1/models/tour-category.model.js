const mongoose = require("mongoose");

const TourCategorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TourCategory",
    default: null,
  },
  slug: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
});

const TourCategory = mongoose.model(
  "TourCategory",
  TourCategorySchema,
  "tour-category"
);

module.exports = TourCategory;
