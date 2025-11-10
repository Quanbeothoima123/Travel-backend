// models/conversation.model.js
const mongoose = require("mongoose");

const ParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const GroupInfoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    _id: false,
  }
);

const LastMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    content: {
      type: String,
      default: null,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "video", "audio", "system"],
      default: "text",
    },
    createdAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
      default: "private",
    },
    participants: {
      type: [ParticipantSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v.length >= 2;
        },
        message: "Conversation must have at least 2 participants",
      },
    },
    groupInfo: {
      type: GroupInfoSchema,
      default: null,
    },
    lastMessage: {
      type: LastMessageSchema,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // Danh sách user đã xóa conversation này (soft delete)
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Số tin nhắn chưa đọc cho từng user
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    // User nào đã seen tin nhắn cuối
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes quan trọng
ConversationSchema.index({ "participants.userId": 1, lastMessageAt: -1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ type: 1 });

const Conversation = mongoose.model(
  "Conversation",
  ConversationSchema,
  "conversations"
);
module.exports = Conversation;
