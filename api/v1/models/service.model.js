const mongoose = require("mongoose");

const ServiceCategorySchema = new mongoose.Schema({
  title: String,
  parentId: String,
  slug: String,
});

const ServiceCategory = mongoose.model(
  "ServiceCategory",
  ServiceCategorySchema,
  "services"
);
module.exports = ServiceCategory;
