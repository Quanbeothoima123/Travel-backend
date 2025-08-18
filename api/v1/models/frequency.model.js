const mongoose = require("mongoose");

const FrequencySchema = new mongoose.Schema({
  title: String,
});

const Frequency = mongoose.model("Frequency", FrequencySchema, "frequency");
module.exports = Frequency;
