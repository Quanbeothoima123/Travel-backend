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

//  Index tìm kiếm
ChatSchema.index({ participants: 1 });
ChatSchema.index({ lastMessageAt: -1 });

//  QUAN TRỌNG: Unique index cho private chat
ChatSchema.index(
  { participants: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "private" },
  }
);

const Chat = mongoose.model("Chat", ChatSchema, "chats");
module.exports = Chat;
