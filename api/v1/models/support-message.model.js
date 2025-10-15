// api/v1/models/supportMessage.model.js
const mongoose = require("mongoose");

const SupportMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportConversation",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Loại người gửi
    senderType: {
      type: String,
      enum: ["user", "admin", "system"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    // Loại tin nhắn
    type: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },

    // File đính kèm (nếu có)
    attachment: {
      url: String,
      filename: String,
      filesize: Number,
      mimetype: String,
    },

    // Đã đọc chưa
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Tin nhắn hệ thống (ví dụ: "Admin đã tham gia cuộc trò chuyện")
    isSystemMessage: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index để query nhanh
SupportMessageSchema.index({ conversationId: 1, createdAt: 1 });
SupportMessageSchema.index({ sender: 1 });

const SupportMessage = mongoose.model(
  "SupportMessage",
  SupportMessageSchema,
  "support-messages"
);

module.exports = SupportMessage;
