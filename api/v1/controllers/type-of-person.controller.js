const TypeOfPerson = require("../models/type-of-person.model");
// [GET] /api/v1/type-of-person
module.exports.getAllTypeOfPerson = async (req, res) => {
  try {
    const persons = await TypeOfPerson.find();
    return res.status(200).json({
      success: true,
      data: persons,
    });
  } catch (err) {
    console.error("Error getAllTypeOfPerson:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
