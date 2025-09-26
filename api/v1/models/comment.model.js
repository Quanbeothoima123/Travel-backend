const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetType: { type: String, required: true }, // "news", "video", "tour"...

    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    content: { type: String, required: true },

    // Bộ đếm nhanh để hiển thị
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },

    // Trạng thái kiểm duyệt
    status: {
      type: String,
      enum: ["approved", "hidden", "spam"],
      default: "approved",
    },

    // Thông tin ẩn danh
    privateInfoUser: {
      isAnonymous: { type: Boolean, default: false },
      displayName: { type: String, default: "Người dùng ẩn danh" },
      avatar: {
        type: String,
        default:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Hacker_behind_PC.svg/800px-Hacker_behind_PC.svg.png",
      }, // có thể set ảnh mặc định cho ẩn danh
    },
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", CommentSchema, "comment");
module.exports = Comment;
