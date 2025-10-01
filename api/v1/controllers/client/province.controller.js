const Province = require("../../models/province.model");
module.exports.getAll = async (req, res) => {
  try {
    const provinces = await Province.find();
    res.status(200).json(provinces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
