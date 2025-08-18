const mongoose = require("mongoose");

const HotelSchema = new mongoose.Schema({
  name: String,
  thumbnail: String,
  images: [String],
  description: String,
  price: Number,
  discount: Number,
  star: Number,
});

const Hotel = mongoose.model("Hotel", HotelSchema, "hotels");
module.exports = Hotel;
