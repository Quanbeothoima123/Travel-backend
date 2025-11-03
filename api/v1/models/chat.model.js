// models/chat.model.js
const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    type: {
      type: String,
      enum: ["private", "group"],
      default: "private",
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    unreadCount: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 0 },
      },
    ],
    groupName: { type: String },
    groupAvatar: { type: String },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// ✅ Chỉ giữ index để tìm kiếm nhanh, KHÔNG unique
ChatSchema.index({ participants: 1 });
ChatSchema.index({ lastMessageAt: -1 });
ChatSchema.index({ type: 1 });

const Chat = mongoose.model("Chat", ChatSchema, "chats");
module.exports = Chat;
