const Comment = require("../../models/comment.model");
const LikeComment = require("../../models/like-comment.model");
const DislikeComment = require("../../models/dislike-comment-model");

const dislikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res
        .status(400)
        .json({ success: false, message: "commentId là bắt buộc" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Bình luận không tồn tại" });
    }

    const existingDislike = await DislikeComment.findOne({ userId, commentId });
    if (existingDislike) {
      return res
        .status(400)
        .json({ success: false, message: "Bạn đã dislike bình luận này rồi" });
    }

    await LikeComment.findOneAndDelete({ userId, commentId });

    const newDislike = new DislikeComment({
      userId,
      commentId,
      isAnonymous: comment.privateInfoUser?.isAnonymous || false,
    });
    await newDislike.save();

    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, { likeCount, dislikeCount });

    return res
      .status(200)
      .json({
        success: true,
        message: "Dislike thành công",
        data: { likeCount, dislikeCount },
      });
  } catch (error) {
    console.error("Error disliking comment:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi server khi dislike bình luận",
        error: error.message,
      });
  }
};

const undislikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res
        .status(400)
        .json({ success: false, message: "commentId là bắt buộc" });
    }

    const deletedDislike = await DislikeComment.findOneAndDelete({
      userId,
      commentId,
    });
    if (!deletedDislike) {
      return res
        .status(400)
        .json({ success: false, message: "Bạn chưa dislike bình luận này" });
    }

    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, { likeCount, dislikeCount });

    return res
      .status(200)
      .json({
        success: true,
        message: "Undislike thành công",
        data: { likeCount, dislikeCount },
      });
  } catch (error) {
    console.error("Error undisliking comment:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi server khi undislike bình luận",
        error: error.message,
      });
  }
};

module.exports = { dislikeComment, undislikeComment };
