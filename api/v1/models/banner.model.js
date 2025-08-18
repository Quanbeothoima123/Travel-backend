const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema({
  title: String,
  images: [String],
  type: String,
});

const Banner = mongoose.model("Banner", BannerSchema, "banner");
module.exports = Banner;
