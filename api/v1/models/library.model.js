const mongoose = require("mongoose");

const LibraryCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const LibraryCategory = mongoose.model(
  "LibraryCategory",
  LibraryCategorySchema,
  "libraries"
);
module.exports = LibraryCategory;
