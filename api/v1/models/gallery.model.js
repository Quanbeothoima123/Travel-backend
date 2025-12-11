const mongoose = require("mongoose");
const slugify = require("slugify");

const GallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
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

//  Auto tạo slug trước khi validate (FIX LỖI)
GallerySchema.pre("validate", async function (next) {
  try {
    if (this.isModified("title") || this.isNew) {
      // Tạo slug cơ bản từ title
      let baseSlug = slugify(this.title, {
        lower: true,
        strict: true,
        locale: "vi", // Hỗ trợ tiếng Việt tốt hơn
        remove: /[*+~.()'"!:@]/g, // Loại bỏ ký tự đặc biệt
      });

      // Xử lý trường hợp slug trùng bằng cách thêm số phía sau
      let slug = baseSlug;
      let counter = 1;

      // Kiểm tra slug đã tồn tại chưa (trừ chính document này nếu đang update)
      while (
        await this.constructor.findOne({
          slug,
          _id: { $ne: this._id },
          deleted: false,
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      this.slug = slug;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Index để tăng performance khi query
GallerySchema.index({ slug: 1 });
GallerySchema.index({ galleryCategory: 1, deleted: 1 });
GallerySchema.index({ tour: 1, deleted: 1 });
GallerySchema.index({ tourCategory: 1, deleted: 1 });
GallerySchema.index({ deleted: 1, active: 1 });
GallerySchema.index({ createdAt: -1 });

const Gallery = mongoose.model("Gallery", GallerySchema, "gallery");
module.exports = Gallery;
