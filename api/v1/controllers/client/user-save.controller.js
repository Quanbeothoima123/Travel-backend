const UserSave = require("../../models/user-save.model");
const News = require("../../models/news.model");
const Tour = require("../../models/tour.model");
const Vehicle = require("../../models/vehicle.model");
const mongoose = require("mongoose");

const MODEL_MAP = {
  news: News,
  tour: Tour,
  vehicle: Vehicle,
  // event: Event, // thêm nếu có
};

// 🔹 Kiểm tra model tương ứng
function getModelByType(type) {
  return MODEL_MAP[type] || null;
}

// 🔹 Lấy trạng thái đã lưu chưa
module.exports.getStatus = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid target ID" });
    }

    if (!getModelByType(targetType)) {
      return res.status(400).json({ error: "Invalid target type" });
    }

    const favorite = userId
      ? await UserSave.findOne({ userId, targetId, targetType }).lean()
      : null;

    res.json({ favorite });
  } catch (error) {
    console.error("Error fetching save status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 🔹 Thêm save
module.exports.addSave = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const userId = req.user?.userId;
    const Model = getModelByType(targetType);

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid target ID" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!Model) {
      return res.status(400).json({ error: "Invalid target type" });
    }

    const existing = await UserSave.findOne({ userId, targetId, targetType });
    if (existing) {
      return res.status(200).json({ message: "Already saved" });
    }

    const favorite = await UserSave.create({ userId, targetId, targetType });

    await Model.findByIdAndUpdate(
      targetId,
      { $inc: { saves: 1 } },
      { new: true }
    );

    res.status(201).json({ message: "Saved successfully", favorite });
  } catch (error) {
    console.error("Error adding save:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 🔹 Xóa save
module.exports.deleteSave = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const userId = req.user?.userId;
    const Model = getModelByType(targetType);

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid target ID" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!Model) {
      return res.status(400).json({ error: "Invalid target type" });
    }

    const deleted = await UserSave.findOneAndDelete({
      userId,
      targetId,
      targetType,
    });
    if (!deleted) {
      return res.status(404).json({ error: "Save not found" });
    }

    const updated = await Model.findByIdAndUpdate(
      targetId,
      { $inc: { saves: -1 } },
      { new: true }
    );

    if (updated && updated.saves < 0) {
      updated.saves = 0;
      await updated.save();
    }

    res.json({ message: "Removed from saved list" });
  } catch (error) {
    console.error("Error deleting save:", error);
    res.status(500).json({ error: "Server error" });
  }
};
