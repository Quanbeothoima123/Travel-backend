const mongoose = require("mongoose");

const TermSchema = new mongoose.Schema({
  title: String,
  icon: String,
});

const Term = mongoose.model("Term", TermSchema, "terms");
module.exports = Term;
