const Frequency = require("../../models/frequency.model");
module.exports.getAll = async (req, res) => {
  try {
    const frequencies = await Frequency.find();
    res.status(200).json(frequencies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
