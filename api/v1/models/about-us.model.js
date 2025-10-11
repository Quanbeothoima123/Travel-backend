const mongoose = require("mongoose");

const AboutUsSchema = new mongoose.Schema(
  {
    // ===== THÔNG TIN CƠ BẢN =====
    companyName: { type: String, required: true },
    slogan: { type: String },
    shortDescription: { type: String }, // Plain text
    longDescription: { type: String }, // HTML from TinyMCE

    // ===== LỊCH SỬ =====
    foundedYear: { type: Number },
    founderName: { type: String },
    foundingStory: { type: String }, // HTML from TinyMCE

    // ===== GIÁ TRỊ CỐT LÕI =====
    mission: { type: String }, // HTML from TinyMCE
    vision: { type: String }, // HTML from TinyMCE
    coreValues: [
      {
        title: { type: String, required: true },
        description: { type: String }, // HTML from TinyMCE
        icon: { type: String }, // URL or icon class
      },
    ],

    // ===== THÀNH TỰU & SỐ LIỆU =====
    achievements: [
      {
        title: { type: String, required: true },
        value: { type: String, required: true }, // "10000+", "98%"
        description: { type: String }, // Plain text
        icon: { type: String },
      },
    ],

    // ===== ĐỘI NGŨ =====
    teamMembers: [
      {
        name: { type: String, required: true },
        position: { type: String, required: true },
        bio: { type: String }, // HTML from TinyMCE
        avatar: { type: String }, // Cloudinary URL
        email: { type: String },
        phone: { type: String },
        socialLinks: {
          facebook: { type: String },
          linkedin: { type: String },
          twitter: { type: String },
        },
      },
    ],

    // ===== CHI NHÁNH/VĂN PHÒNG =====
    branches: [
      {
        name: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String },
        province: { type: String },
        phone: { type: String },
        email: { type: String },
        mapUrl: { type: String },
        isHeadquarter: { type: Boolean, default: false },
        workingHours: { type: String },
        image: { type: String }, // Cloudinary URL
      },
    ],

    // ===== CHỨNG NHẬN & GIẤY PHÉP =====
    certifications: [
      {
        title: { type: String, required: true },
        issuer: { type: String },
        issueDate: { type: Date },
        certificateNumber: { type: String },
        imageUrl: { type: String }, // Cloudinary URL
        verificationUrl: { type: String },
        description: { type: String }, // Plain text
      },
    ],

    // ===== ĐỐI TÁC =====
    partners: [
      {
        name: { type: String, required: true },
        logo: { type: String }, // Cloudinary URL
        website: { type: String },
        description: { type: String }, // Plain text
      },
    ],

    // ===== MẠNG XÃ HỘI =====
    socialMedia: {
      facebook: { type: String },
      instagram: { type: String },
      youtube: { type: String },
      tiktok: { type: String },
      twitter: { type: String },
      linkedin: { type: String },
      zalo: { type: String },
    },

    // ===== LIÊN HỆ =====
    contact: {
      hotline: { type: String },
      email: { type: String },
      supportEmail: { type: String },
      address: { type: String },
      workingHours: { type: String },
    },

    // ===== MEDIA =====
    media: {
      logo: { type: String }, // Cloudinary URL
      logoWhite: { type: String }, // Cloudinary URL
      favicon: { type: String }, // Cloudinary URL
      coverImage: { type: String }, // Cloudinary URL
      companyImages: [{ type: String }], // Array of Cloudinary URLs
      companyVideo: { type: String }, // Video URL
    },

    // ===== TẦM NHÌN TƯƠNG LAI =====
    futureGoals: [
      {
        year: { type: Number },
        goal: { type: String }, // HTML from TinyMCE
      },
    ],

    // ===== GIẢI THƯỞNG =====
    awards: [
      {
        title: { type: String, required: true },
        year: { type: Number },
        organization: { type: String },
        description: { type: String }, // HTML from TinyMCE
        imageUrl: { type: String }, // Cloudinary URL
      },
    ],

    // ===== QUY TRÌNH LÀM VIỆC =====
    workProcess: [
      {
        step: { type: Number, required: true },
        title: { type: String, required: true },
        description: { type: String }, // HTML from TinyMCE
        icon: { type: String },
      },
    ],

    // ===== TẠI SAO CHỌN CHÚNG TÔI =====
    whyChooseUs: [
      {
        title: { type: String, required: true },
        description: { type: String }, // HTML from TinyMCE
        icon: { type: String },
      },
    ],

    // ===== CHÍNH SÁCH =====
    policies: {
      privacyPolicy: { type: String }, // HTML from TinyMCE
      termsOfService: { type: String }, // HTML from TinyMCE
      refundPolicy: { type: String }, // HTML from TinyMCE
      cookiePolicy: { type: String }, // HTML from TinyMCE
    },

    // ===== SEO =====
    seo: {
      metaTitle: { type: String },
      metaDescription: { type: String },
      metaKeywords: [{ type: String }],
      ogImage: { type: String }, // Cloudinary URL
    },

    // ===== METADATA =====
    isActive: { type: Boolean, default: true },
    lastUpdatedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      time: { type: Date },
    },
  },
  { timestamps: true }
);

const AboutUs = mongoose.model("AboutUs", AboutUsSchema, "about-us");
module.exports = AboutUs;
