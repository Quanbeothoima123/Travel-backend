const UserShare = require("../../models/user-share.model");
const News = require("../../models/news.model");
const mongoose = require("mongoose");

module.exports.addShare = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid target ID" });
    }

    const shareData = { targetId, targetType };
    if (userId) shareData.userId = userId;

    const share = await UserShare.create(shareData);

    // Nếu là news thì tăng đếm share
    if (targetType === "news") {
      await News.findByIdAndUpdate(targetId, { $inc: { shares: 1 } });
    }

    res.status(201).json({ message: "Share recorded successfully", share });
  } catch (error) {
    console.error("Error adding share:", error);
    res.status(500).json({ error: "Server error" });
  }
};
