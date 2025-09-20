const mongoose = require("mongoose");

const NewsCategorySchema = new mongoose.Schema({
  title: String,
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NewsCategory",
    default: null,
  },
  slug: String,
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
});

const NewsCategory = mongoose.model(
  "NewsCategory",
  NewsCategorySchema,
  "news-category"
);
module.exports = NewsCategory;
