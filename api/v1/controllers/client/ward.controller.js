const Ward = require("../../models/ward.model");
module.exports.getWardsByProvince = async (req, res) => {
  try {
    const { provinceCode } = req.params;
    const wards = await Ward.find({ parent_code: provinceCode });
    res.json(wards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
