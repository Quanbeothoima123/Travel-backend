const DepartPlace = require("../../models/depart-place.model");
module.exports.getAll = async (req, res) => {
  try {
    const depart_places = await DepartPlace.find();
    res.status(200).json(depart_places);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
