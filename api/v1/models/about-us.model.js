const mongoose = require("mongoose");

const AboutUsSchema = new mongoose.Schema(
  {
    // ===== THÔNG TIN CƠ BẢN =====
    companyName: { type: String, required: true },
    slogan: { type: String },
    shortDescription: { type: String }, // Plain text
    longDescription: { type: String }, // HTML from TinyMCE

    // ===== THÔNG TIN BỔ SUNG =====
    establishmentDate: { type: Date }, // Ngày thành lập cụ thể
    taxCode: { type: String }, // Mã số thuế
    businessLicense: { type: String }, // Giấy phép kinh doanh
    legalRepresentative: { type: String }, // Người đại diện pháp luật

    // ===== LỊCH SỬ =====
    foundedYear: { type: Number },
    founderName: { type: String },
    foundingStory: { type: String }, // HTML from TinyMCE

    // ===== MILESTONE - Cột mốc phát triển =====
    milestones: [
      {
        year: { type: Number, required: true },
        title: { type: String, required: true },
        description: { type: String }, // HTML from TinyMCE
        image: { type: String }, // Cloudinary URL
      },
    ],

    // ===== GIÁ TRỊ CỐT LÕI =====
    mission: { type: String }, // HTML from TinyMCE
    vision: { type: String }, // HTML from TinyMCE
    coreValues: [
      {
        title: { type: String, required: true },
        description: { type: String }, // HTML from TinyMCE
        icon: { type: String }, // URL or icon class
        order: { type: Number, default: 0 }, // Thứ tự hiển thị
      },
    ],

    // ===== THÀNH TỰU & SỐ LIỆU =====
    achievements: [
      {
        title: { type: String, required: true },
        value: { type: String, required: true }, // "10000+", "98%"
        description: { type: String }, // Plain text
        icon: { type: String },
        order: { type: Number, default: 0 },
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
        department: { type: String }, // Phòng ban
        order: { type: Number, default: 0 },
        socialLinks: {
          facebook: { type: String },
          linkedin: { type: String },
          twitter: { type: String },
          instagram: { type: String },
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
        country: { type: String, default: "Vietnam" },
        phone: { type: String },
        email: { type: String },
        mapUrl: { type: String },
        mapEmbedUrl: { type: String }, // Google Maps embed URL
        latitude: { type: Number },
        longitude: { type: Number },
        isHeadquarter: { type: Boolean, default: false },
        workingHours: { type: String },
        image: { type: String }, // Cloudinary URL
        order: { type: Number, default: 0 },
      },
    ],

    // ===== CHỨNG NHẬN & GIẤY PHÉP =====
    certifications: [
      {
        title: { type: String, required: true },
        issuer: { type: String },
        issueDate: { type: Date },
        expiryDate: { type: Date }, // Ngày hết hạn
        certificateNumber: { type: String },
        imageUrl: { type: String }, // Cloudinary URL
        verificationUrl: { type: String },
        description: { type: String }, // Plain text
        order: { type: Number, default: 0 },
      },
    ],

    // ===== ĐỐI TÁC =====
    partners: [
      {
        name: { type: String, required: true },
        logo: { type: String }, // Cloudinary URL
        website: { type: String },
        description: { type: String }, // Plain text
        category: { type: String }, // Loại đối tác: "strategic", "technology", "business"
        order: { type: Number, default: 0 },
      },
    ],

    // ===== KHÁCH HÀNG TIÊU BIỂU =====
    clients: [
      {
        name: { type: String, required: true },
        logo: { type: String }, // Cloudinary URL
        website: { type: String },
        testimonial: { type: String }, // Đánh giá của khách hàng
        order: { type: Number, default: 0 },
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
      pinterest: { type: String },
      threads: { type: String },
    },

    // ===== LIÊN HỆ =====
    contact: {
      hotline: { type: String },
      email: { type: String },
      supportEmail: { type: String },
      salesEmail: { type: String },
      hrEmail: { type: String }, // Email tuyển dụng
      address: { type: String },
      workingHours: { type: String },
      emergencyContact: { type: String }, // Liên hệ khẩn cấp
    },

    // ===== MEDIA =====
    media: {
      logo: { type: String }, // Cloudinary URL
      logoWhite: { type: String }, // Cloudinary URL
      logoSquare: { type: String }, // Logo vuông cho social media
      favicon: { type: String }, // Cloudinary URL
      coverImage: { type: String }, // Cloudinary URL
      companyImages: [{ type: String }], // Array of Cloudinary URLs
      companyVideo: { type: String }, // Video URL
      introVideo: { type: String }, // Video giới thiệu
    },

    // ===== TẦM NHÌN TƯƠNG LAI =====
    futureGoals: [
      {
        year: { type: Number },
        goal: { type: String }, // HTML from TinyMCE
        order: { type: Number, default: 0 },
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
        order: { type: Number, default: 0 },
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
        order: { type: Number, default: 0 },
      },
    ],

    // ===== DỊCH VỤ CHÍNH =====
    mainServices: [
      {
        title: { type: String, required: true },
        description: { type: String }, // Plain text
        icon: { type: String },
        link: { type: String }, // URL đến trang dịch vụ
        order: { type: Number, default: 0 },
      },
    ],

    // ===== FAQ - Câu hỏi thường gặp =====
    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true }, // HTML from TinyMCE
        category: { type: String }, // Phân loại FAQ
        order: { type: Number, default: 0 },
      },
    ],

    // ===== CHÍNH SÁCH =====
    policies: {
      privacyPolicy: { type: String }, // HTML from TinyMCE
      termsOfService: { type: String }, // HTML from TinyMCE
      refundPolicy: { type: String }, // HTML from TinyMCE
      cookiePolicy: { type: String }, // HTML from TinyMCE
      shippingPolicy: { type: String }, // Chính sách vận chuyển
      warrantyPolicy: { type: String }, // Chính sách bảo hành
    },

    // ===== SEO =====
    seo: {
      metaTitle: { type: String },
      metaDescription: { type: String },
      metaKeywords: [{ type: String }],
      ogImage: { type: String }, // Cloudinary URL
      canonicalUrl: { type: String },
      structuredData: { type: mongoose.Schema.Types.Mixed }, // JSON-LD
    },

    // ===== CÀI ĐẶT HIỂN THỊ =====
    displaySettings: {
      showAchievements: { type: Boolean, default: true },
      showTeam: { type: Boolean, default: true },
      showPartners: { type: Boolean, default: true },
      showTestimonials: { type: Boolean, default: true },
      showMilestones: { type: Boolean, default: true },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "light",
      },
    },

    // ===== METADATA =====
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 }, // Version control
    lastUpdatedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      name: { type: String },
      time: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: "about-us",
  }
);

// Indexes for better performance
AboutUsSchema.index({ isActive: 1 });
AboutUsSchema.index({ "seo.metaTitle": "text", "seo.metaDescription": "text" });

const AboutUs = mongoose.model("AboutUs", AboutUsSchema);
module.exports = AboutUs;
