const TourCategory = require("../../models/tour-category.model");
const Tour = require("../../models/tour.model");
module.exports.getTours = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const total = await Tour.countDocuments(query);

    const tours = await Tour.find(query)
      .populate("categoryId", "title slug")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.json({
      data: tours,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.bulkUpdateTours = async (req, res) => {
  try {
    const { ids, updateData } = req.body; // ids: [tourId1, tourId2,...]

    if (!ids || !updateData) {
      return res.status(400).json({ message: "Missing ids or updateData" });
    }

    await Tour.updateMany({ _id: { $in: ids } }, { $set: updateData });

    res.json({ message: "Bulk update success" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.updateTour = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Tour.findByIdAndUpdate(id, req.body, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Tour not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
