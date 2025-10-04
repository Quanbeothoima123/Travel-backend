const mongoose = require("mongoose");
const UserSaveSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    enum: ["article", "tour", "video", "news", "gallery"],
    required: true,
  },

  note: { type: String },
  labels: [String],

  createdAt: { type: Date, default: Date.now },
});

UserSaveSchema.index(
  { userId: 1, targetId: 1, targetType: 1 },
  { unique: true }
);

const UserSave = mongoose.model("UserSave", UserSaveSchema, "user-save");
module.exports = UserSave;
