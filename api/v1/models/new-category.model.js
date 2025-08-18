const mongoose = require("mongoose");

const NewsCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const NewsCategory = mongoose.model(
  "NewsCategory",
  NewsCategorySchema,
  "news-category"
);
module.exports = NewsCategory;
