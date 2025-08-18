const mongoose = require("mongoose");

const wardSchema = new mongoose.Schema({
  name: String,
  type: String,
  slug: String,
  name_with_type: String,
  path: String,
  path_with_type: String,
  code: String,
  parent_code: String,
});

const Ward = mongoose.model("Ward", wardSchema, "ward");
module.exports = Ward;
