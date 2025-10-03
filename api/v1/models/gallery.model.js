const mongoose = require("mongoose");
const slugify = require("slugify");

const GallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // tiêu đề của gallery
    slug: { type: String, required: true, unique: true }, // slug sẽ được tự động sinh
    shortDescription: { type: String },
    longDescription: { type: String },
    thumbnail: { type: String, required: true },
    images: [
      {
        url: { type: String, required: true },
        title: { type: String },
      },
    ],
    videos: [
      {
        url: { type: String, required: true },
        title: { type: String },
      },
    ],
    tags: [{ type: String }],
    galleryCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GalleryCategory",
    },
    tour: { type: mongoose.Schema.Types.ObjectId, ref: "Tour" },
    tourCategory: { type: mongoose.Schema.Types.ObjectId, ref: "TourCategory" },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },

    createdBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date, default: Date.now },
    },
    updatedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date },
    },
    active: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    deletedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date },
    },
  },
  { timestamps: true }
);

// 🔥 Auto tạo slug trước khi save
GallerySchema.pre("save", function (next) {
  if (this.isModified("title") || this.isNew) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true, // loại bỏ ký tự đặc biệt
    });
  }
  next();
});

const Gallery = mongoose.model("Gallery", GallerySchema, "gallery");
module.exports = Gallery;
