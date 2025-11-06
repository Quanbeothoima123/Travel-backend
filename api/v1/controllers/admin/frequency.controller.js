const Frequency = require("../../models/frequency.model");
// Controller getAll cho Frequency
module.exports.getAll = async (req, res) => {
  try {
    const frequencies = await Frequency.find({ deleted: { $ne: true } });
    res.json({
      success: true,
      data: frequencies, // ✅ Wrap trong object
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
