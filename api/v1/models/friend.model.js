// ========================================
// models/friend.model.js
// ========================================
const mongoose = require("mongoose");
const FriendSchema = new mongoose.Schema(
  {
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook để đảm bảo userA < userB (tránh trùng lặp)
FriendSchema.pre("save", function (next) {
  const a = this.userA.toString();
  const b = this.userB.toString();
  if (a > b) {
    [this.userA, this.userB] = [this.userB, this.userA];
  }
  next();
});

// Index unique để tránh duplicate
FriendSchema.index({ userA: 1, userB: 1 }, { unique: true });
FriendSchema.index({ userA: 1 });
FriendSchema.index({ userB: 1 });

const Friend = mongoose.model("Friend", FriendSchema, "friends");
module.exports = Friend;
