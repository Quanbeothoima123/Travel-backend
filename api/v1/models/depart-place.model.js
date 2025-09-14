const mongoose = require("mongoose");
const DepartPlaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    googleDirection: { type: String, required: true },
    province_depart_place_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProvinceDepartPlace",
    },
    description: { type: String, require: true },
  },
  { timestamps: true }
);

const DepartPlace = mongoose.model(
  "DepartPlace",
  DepartPlaceSchema,
  "depart-place"
);
module.exports = DepartPlace;
