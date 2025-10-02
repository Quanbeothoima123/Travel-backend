const mongoose = require("mongoose");

const GalleryCategorySchema = new mongoose.Schema({
  title: String,
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GalleryCategory",
    default: null,
  },
  slug: String,
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
});

const GalleryCategory = mongoose.model(
  "GalleryCategory",
  GalleryCategorySchema,
  "gallery-category"
);
module.exports = GalleryCategory;
