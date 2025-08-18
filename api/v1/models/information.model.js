const mongoose = require("mongoose");

const InfoCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const InfoCategory = mongoose.model(
  "InfoCategory",
  InfoCategorySchema,
  "information"
);
module.exports = InfoCategory;
