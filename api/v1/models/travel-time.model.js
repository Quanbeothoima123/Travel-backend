const mongoose = require("mongoose");

const TravelTimeSchema = new mongoose.Schema({
  day: Number,
  night: Number,
});

const TravelTime = mongoose.model(
  "TravelTime",
  TravelTimeSchema,
  "travel-time"
);
module.exports = TravelTime;
