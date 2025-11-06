const Filter = require("../../models/filter.model");
// Controller getAll cho Filter
module.exports.getAll = async (req, res) => {
  try {
    const filters = await Filter.find({ deleted: { $ne: true } });
    res.json({
      success: true,
      data: filters, // ✅ Wrap trong object
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
