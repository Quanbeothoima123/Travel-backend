import mongoose from "mongoose";

const UserRatingSchema = new mongoose.Schema({
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

  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String }, // nếu muốn kèm review text

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// 1 user chỉ được rating 1 lần cho 1 content (có thể update)
UserRatingSchema.index(
  { userId: 1, targetId: 1, targetType: 1 },
  { unique: true }
);

export default mongoose.model("UserRating", UserRatingSchema);
