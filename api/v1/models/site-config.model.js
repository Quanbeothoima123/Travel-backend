const mongoose = require("mongoose");

const SiteConfigSchema = new mongoose.Schema(
  {
    // ============================================================
    // THÔNG TIN CÔNG TY
    // ============================================================
    companyName: {
      type: String,
      required: true,
    },
    companyNameEn: String,
    companyShortName: String,
    companyDescription: String,

    // Trụ sở chính
    headquartersAddress: String,
    headquartersPhone: [String],
    headquartersEmail: String,

    // Giấy phép kinh doanh
    businessLicenseNumber: String,
    businessLicenseIssuer: String,

    // Giấy phép lữ hành quốc tế
    travelLicenseNumber: String,
    travelLicenseType: String,

    // ============================================================
    // CHI NHÁNH
    // ============================================================
    branches: [
      {
        name: {
          type: String,
          required: true,
        },
        address: {
          type: String,
          required: true,
        },
        phone: [String],
        email: String,
        order: {
          type: Number,
          default: 0,
        },
      },
    ],

    // ============================================================
    // LOGO VÀ HÌNH ẢNH
    // ============================================================
    logo: String,
    logoLight: String,
    logoDark: String,
    favicon: String,
    ogImage: String,

    // ============================================================
    // MẠNG XÃ HỘI
    // ============================================================
    socialMedia: [
      {
        platform: {
          type: String,
          enum: [
            "facebook",
            "instagram",
            "tiktok",
            "twitter",
            "youtube",
            "linkedin",
          ],
        },
        url: String,
        icon: String,
        order: {
          type: Number,
          default: 0,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // ============================================================
    // CONTACT FLOATING
    // ============================================================
    contactFloatingEnabled: {
      type: Boolean,
      default: true,
    },
    contactFloatingItems: [
      {
        id: {
          type: String,
          required: true,
        },
        icon: String,
        alt: String,
        label: String,
        link: String,
        order: {
          type: Number,
          default: 0,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // ============================================================
    // NEWSLETTER
    // ============================================================
    newsletterEnabled: {
      type: Boolean,
      default: true,
    },
    newsletterTitle: String,
    newsletterPlaceholder: String,

    // ============================================================
    // SEO MẶC ĐỊNH
    // ============================================================
    seoDefaultTitle: String,
    seoDefaultDescription: String,
    seoDefaultKeywords: [String],
    googleAnalyticsId: String,
    googleTagManagerId: String,
    facebookPixelId: String,

    // ============================================================
    // CÀI ĐẶT KHÁC
    // ============================================================
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: String,
    timezone: {
      type: String,
      default: "Asia/Ho_Chi_Minh",
    },

    // ============================================================
    // METADATA
    // ============================================================
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: String,
      default: "1.0",
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================
SiteConfigSchema.index({ isActive: 1 });
SiteConfigSchema.index({ companyName: "text" });

// ============================================================
// EXPORT
// ============================================================
const SiteConfig = mongoose.model(
  "SiteConfig",
  SiteConfigSchema,
  "site_configs"
);

module.exports = SiteConfig;
