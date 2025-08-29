const TravelTime = require("../../models/travel-time.model");
module.exports.getAll = async (req, res) => {
  try {
    const travelTimes = await TravelTime.find();
    res.status(200).json(travelTimes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
