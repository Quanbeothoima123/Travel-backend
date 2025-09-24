const UserShare = require("../../models/user-share.model");
const News = require("../../models/news.model");
const mongoose = require("mongoose");
// Thêm share
module.exports.addShareForNews = async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user?.userId;
    const targetType = "news";

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid news ID" });
    }

    const shareData = {
      targetId,
      targetType,
    };
    if (userId) {
      shareData.userId = userId; // chỉ thêm nếu có
    }

    const share = await UserShare.create(shareData);

    await News.findByIdAndUpdate(
      targetId,
      { $inc: { shares: 1 } },
      { new: true }
    );

    res.status(201).json({ message: "Chia sẻ thành công", share });
  } catch (error) {
    console.error("Error adding share:", error);
    res.status(500).json({ error: "Server error" });
  }
};
