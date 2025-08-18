const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema({
  name: String,
  image: String,
});

const Vehicle = mongoose.model("Vehicle", VehicleSchema, "vehicles");
module.exports = Vehicle;
