import mongoose from "mongoose";

const UserShareSchema = new mongoose.Schema({
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
    enum: ["article", "tour", "video"],
    required: true,
  },

  platform: {
    type: String,
    enum: ["facebook", "twitter", "zalo", "link"],
    default: "link",
  },

  createdAt: { type: Date, default: Date.now },
});

UserShareSchema.index({ userId: 1, targetId: 1, targetType: 1 });

export default mongoose.model("UserShare", UserShareSchema);
