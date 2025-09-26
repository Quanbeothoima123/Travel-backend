const mongoose = require("mongoose");

const DislikeCommentSchema = new mongoose.Schema(
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

const DislikeComment = mongoose.model(
  "DislikeComment",
  DislikeCommentSchema,
  "dislike-comment"
);
module.exports = DislikeComment;
