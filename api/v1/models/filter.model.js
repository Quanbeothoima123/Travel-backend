const mongoose = require("mongoose");
const FilterSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
    slug: { type: String, required: true },
  },
  { timestamps: true }
);

const Filter = mongoose.model("Filter", FilterSchema, "filters");
module.exports = Filter;
