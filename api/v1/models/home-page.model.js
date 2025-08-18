const mongoose = require("mongoose");

const HomeCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const HomeCategory = mongoose.model(
  "HomeCategory",
  HomeCategorySchema,
  "home-page"
);
module.exports = HomeCategory;
