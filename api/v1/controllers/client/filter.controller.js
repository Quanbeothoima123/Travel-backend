const Filter = require("../../models/filter.model");
module.exports.getAll = async (req, res) => {
  try {
    const filters = await Filter.find();
    res.status(200).json(filters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
