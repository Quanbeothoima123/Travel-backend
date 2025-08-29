const TypeOfPerson = require("../../models/type-of-person.model");
module.exports.getAll = async (req, res) => {
  try {
    const typeOfPersons = await TypeOfPerson.find();
    res.status(200).json(typeOfPersons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
