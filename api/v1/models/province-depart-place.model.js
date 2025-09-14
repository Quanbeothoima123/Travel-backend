const mongoose = require("mongoose");
const ProvinceDepartPlaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);

const ProvinceDepartPlace = mongoose.model(
  "ProvinceDepartPlace",
  ProvinceDepartPlaceSchema,
  "province-depart-place"
);
module.exports = ProvinceDepartPlace;
