const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  slug: { type: String, required: true },
});

const Vehicle = mongoose.model("Vehicle", VehicleSchema, "vehicles");
module.exports = Vehicle;
