const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema(
  {
    // Basic fields
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    thumbnail: { type: String },
    excerpt: { type: String, trim: true },
    content: { type: String, required: true },

    // SEO fields
    metaTitle: { type: String },
    metaDescription: { type: String },
    metaKeywords: [{ type: String }],

    // Relations
    newsCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsCategory",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TourCategory",
    },
    destinationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Province" }],
    relatedTourIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tour" }],

    // Author
    author: {
      type: {
        type: String,
        enum: ["admin", "user"],
        required: true,
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
    },

    // Tags
    tags: [{ type: String, trim: true }],

    // Article type
    type: {
      type: String,
      enum: ["news", "guide", "review", "event", "promotion"],
      default: "news",
    },

    // Status
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    // Publishing
    publishedAt: { type: Date },

    // Engagement
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },

    // Event related
    eventDate: { type: Date },

    // Gallery
    highlightImages: [{ type: String }],

    // Language
    language: {
      type: String,
      enum: ["vi", "en"],
      default: "vi",
    },

    // Soft delete
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // Tracking
    createdBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date },
    },
    updatedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date },
    },
    deletedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// NewsSchema.index({ slug: 1 }, { unique: true });
// NewsSchema.index({ status: 1, publishedAt: -1 });
// NewsSchema.index({ categoryId: 1 });
// NewsSchema.index({ deleted: 1 });

const News = mongoose.model("News", NewsSchema, "news");
module.exports = News;
