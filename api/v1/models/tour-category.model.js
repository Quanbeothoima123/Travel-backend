const mongoose = require("mongoose");

const TourCategorySchema = new mongoose.Schema({
  title: String,
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Đổi thành ObjectId
  slug: String,
});

const TourCategory = mongoose.model(
  "TourCategory",
  TourCategorySchema,
  "tour-category"
);
module.exports = TourCategory;
