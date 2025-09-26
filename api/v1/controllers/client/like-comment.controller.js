const Comment = require("../../models/comment.model");
const LikeComment = require("../../models/like-comment.model");
const DislikeComment = require("../../models/dislike-comment-model");

const likeComment = async (req, res) => {
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

    const existingLike = await LikeComment.findOne({ userId, commentId });
    if (existingLike) {
      return res
        .status(400)
        .json({ success: false, message: "Bạn đã like bình luận này rồi" });
    }

    await DislikeComment.findOneAndDelete({ userId, commentId });

    const newLike = new LikeComment({
      userId,
      commentId,
      isAnonymous: comment.privateInfoUser?.isAnonymous || false,
    });
    await newLike.save();

    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, { likeCount, dislikeCount });

    return res.status(200).json({
      success: true,
      message: "Like thành công",
      data: { likeCount, dislikeCount },
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi like bình luận",
      error: error.message,
    });
  }
};

const unlikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.userId;

    if (!commentId) {
      return res
        .status(400)
        .json({ success: false, message: "commentId là bắt buộc" });
    }

    const deletedLike = await LikeComment.findOneAndDelete({
      userId,
      commentId,
    });
    if (!deletedLike) {
      return res
        .status(400)
        .json({ success: false, message: "Bạn chưa like bình luận này" });
    }

    const likeCount = await LikeComment.countDocuments({ commentId });
    const dislikeCount = await DislikeComment.countDocuments({ commentId });

    await Comment.findByIdAndUpdate(commentId, { likeCount, dislikeCount });

    return res.status(200).json({
      success: true,
      message: "Unlike thành công",
      data: { likeCount, dislikeCount },
    });
  } catch (error) {
    console.error("Error unliking comment:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi unlike bình luận",
      error: error.message,
    });
  }
};

module.exports = { likeComment, unlikeComment };
