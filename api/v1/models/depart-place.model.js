const mongoose = require("mongoose");
const DepartPlaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    googleDirection: { type: String, required: true },
  },
  { timestamps: true }
);

const DepartPlace = mongoose.model(
  "DepartPlace",
  DepartPlaceSchema,
  "depart-place"
);
module.exports = DepartPlace;
