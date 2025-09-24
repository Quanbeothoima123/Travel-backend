const UserFavorite = require("../../models/user-favorite.model");
const News = require("../../models/news.model");
const mongoose = require("mongoose");
module.exports.likePost = async (req, res) => {
  try {
    const vehicles = await Vehicle.find();
    res.status(200).json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getStatusForNews = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid news ID" });
    }

    const favorite = userId
      ? await UserFavorite.findOne({ userId, targetId }).lean()
      : null;

    res.json({ favorite });
  } catch (error) {
    console.error("Error fetching favorite status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports.getStatusForNews = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid news ID" });
    }

    const favorite = userId
      ? await UserFavorite.findOne({ userId, targetId }).lean()
      : null;

    res.json({ favorite });
  } catch (error) {
    console.error("Error fetching favorite status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Thêm favorite
module.exports.addFavoriteForNews = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user?.userId;
    const targetType = "news";

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid news ID" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // kiểm tra đã có chưa
    const existing = await UserFavorite.findOne({ userId, targetId });
    if (existing) {
      return res.status(200).json({ message: "Already favorited" });
    }

    const favorite = await UserFavorite.create({
      userId,
      targetId,
      targetType,
    });
    await News.findByIdAndUpdate(
      targetId,
      { $inc: { likes: 1 } }, // tăng view thêm 1
      { new: true }
    );
    res.status(201).json({ message: "Added to favorites", favorite });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Xóa favorite
module.exports.deleteFavoriteForNews = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid news ID" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const deleted = await UserFavorite.findOneAndDelete({ userId, targetId });
    if (!deleted) {
      return res.status(404).json({ error: "Favorite not found" });
    }
    const updated = await News.findByIdAndUpdate(
      targetId,
      { $inc: { likes: -1 } },
      { new: true }
    );

    if (updated.likes < 0) {
      updated.likes = 0;
      await updated.save();
    }
    res.json({ message: "Removed from favorites" });
  } catch (error) {
    console.error("Error deleting favorite:", error);
    res.status(500).json({ error: "Server error" });
  }
};
