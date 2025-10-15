// api/v1/models/supportConversation.model.js
const mongoose = require("mongoose");

const SupportConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Thông tin từ pre-chat form
    issueDescription: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      default: "",
    },

    // Trạng thái cuộc trò chuyện
    status: {
      type: String,
      enum: ["waiting", "active", "closed"],
      default: "waiting",
    },

    // Admin đang xử lý (nếu có)
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Thời gian
    startedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
      default: null,
    },

    // Tin nhắn cuối cùng (để hiển thị preview)
    lastMessage: {
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      sentAt: Date,
    },

    // Feedback sau khi đóng
    feedback: {
      isResolved: {
        type: Boolean,
        default: null,
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      comment: {
        type: String,
        default: "",
      },
      submittedAt: {
        type: Date,
        default: null,
      },
    },

    // Đếm tin nhắn chưa đọc
    unreadCount: {
      user: { type: Number, default: 0 },
      admin: { type: Number, default: 0 },
    },

    // Tags/Category cho admin
    tags: [String],
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Ghi chú nội bộ của admin
    adminNotes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes để tìm kiếm nhanh
SupportConversationSchema.index({ user: 1, status: 1 });
SupportConversationSchema.index({ status: 1, createdAt: -1 });
SupportConversationSchema.index({ assignedAdmin: 1, status: 1 });

const SupportConversation = mongoose.model(
  "SupportConversation",
  SupportConversationSchema,
  "support-conversations"
);

module.exports = SupportConversation;
