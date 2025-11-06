const Vehicle = require("../../models/vehicle.model");
// Controller getAll cho Vehicle
module.exports.getAll = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ deleted: { $ne: true } });
    res.json({
      success: true,
      data: vehicles, // ✅ Wrap trong object
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
