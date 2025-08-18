const mongoose = require("mongoose");

const ContactCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const ContactCategory = mongoose.model(
  "ContactCategory",
  ContactCategorySchema,
  "contact"
);
module.exports = ContactCategory;
