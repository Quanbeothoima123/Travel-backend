const mongoose = require("mongoose");

const TourCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const TourCategory = mongoose.model(
  "TourCategory",
  TourCategorySchema,
  "tour-category"
);
module.exports = TourCategory;
