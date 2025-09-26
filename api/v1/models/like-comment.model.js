const mongoose = require("mongoose");

const LikeCommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },

    // Flag ẩn danh
    isAnonymous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const LikeComment = mongoose.model(
  "LikeComment",
  LikeCommentSchema,
  "like-comment"
);
module.exports = LikeComment;
