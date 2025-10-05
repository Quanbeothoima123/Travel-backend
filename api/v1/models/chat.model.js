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
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    groupName: { type: String }, // Cho group chat
    groupAvatar: { type: String }, // Cho group chat
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Cho group chat
    lastMessageAt: { type: Date, default: Date.now }, // Để sort sidebar
    unreadCount: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 0 },
      },
    ], // Đếm tin nhắn chưa đọc
  },

  { timestamps: true }
);

const Chat = mongoose.model("Chat", ChatSchema, "chats");

module.exports = Chat;
