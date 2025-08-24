const mongoose = require("mongoose");

const TypeOfPersonSchema = new mongoose.Schema({
  name: String,
});

const TypeOfPerson = mongoose.model(
  "TypeOfPerson",
  TypeOfPersonSchema,
  "type-of-person"
);
module.exports = TypeOfPerson;
