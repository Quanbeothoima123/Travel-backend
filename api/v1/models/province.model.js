const mongoose = require("mongoose");

const provinceSchema = new mongoose.Schema({
  name: String,
  slug: String,
  type: String,
  name_with_type: String,
  code: String,
});

const Province = mongoose.model("Province", provinceSchema, "province");
module.exports = Province;
