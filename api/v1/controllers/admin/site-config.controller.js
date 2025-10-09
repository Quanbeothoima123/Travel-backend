const SiteConfig = require("../../models/site-config.model");

// GET /api/v1/admin/site-config
// Lấy cấu hình site (chỉ có 1 config active)
module.exports.get = async (req, res) => {
  try {
    const config = await SiteConfig.findOne({ isActive: true });

    if (!config) {
      return res.status(404).json({
        message: "Chưa có cấu hình nào được tạo",
      });
    }

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/v1/admin/site-config
// Tạo mới cấu hình site
module.exports.create = async (req, res) => {
  try {
    // Kiểm tra xem đã có config active chưa
    const existingConfig = await SiteConfig.findOne({ isActive: true });

    if (existingConfig) {
      return res.status(400).json({
        message: "Đã có cấu hình active. Vui lòng cập nhật thay vì tạo mới.",
      });
    }

    const config = new SiteConfig(req.body);
    await config.save();

    res.status(201).json({
      message: "Tạo cấu hình thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config
// Cập nhật cấu hình site
module.exports.update = async (req, res) => {
  try {
    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật cấu hình thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/company-info
// Cập nhật thông tin công ty
module.exports.updateCompanyInfo = async (req, res) => {
  try {
    const {
      companyName,
      companyNameEn,
      companyShortName,
      companyDescription,
      headquartersAddress,
      headquartersPhone,
      headquartersEmail,
      businessLicenseNumber,
      businessLicenseIssuer,
      travelLicenseNumber,
      travelLicenseType,
    } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          companyName,
          companyNameEn,
          companyShortName,
          companyDescription,
          headquartersAddress,
          headquartersPhone,
          headquartersEmail,
          businessLicenseNumber,
          businessLicenseIssuer,
          travelLicenseNumber,
          travelLicenseType,
        },
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật thông tin công ty thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/branches
// Cập nhật danh sách chi nhánh
module.exports.updateBranches = async (req, res) => {
  try {
    const { branches } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      { $set: { branches } },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật chi nhánh thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/branding
// Cập nhật logo và hình ảnh
module.exports.updateBranding = async (req, res) => {
  try {
    const { logo, logoLight, logoDark, favicon, ogImage } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          logo,
          logoLight,
          logoDark,
          favicon,
          ogImage,
        },
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật branding thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/social-media
// Cập nhật mạng xã hội
module.exports.updateSocialMedia = async (req, res) => {
  try {
    const { socialMedia } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      { $set: { socialMedia } },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật mạng xã hội thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/contact-floating
// Cập nhật contact floating
module.exports.updateContactFloating = async (req, res) => {
  try {
    const { contactFloatingEnabled, contactFloatingItems } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          contactFloatingEnabled,
          contactFloatingItems,
        },
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật contact floating thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/newsletter
// Cập nhật newsletter
module.exports.updateNewsletter = async (req, res) => {
  try {
    const { newsletterEnabled, newsletterTitle, newsletterPlaceholder } =
      req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          newsletterEnabled,
          newsletterTitle,
          newsletterPlaceholder,
        },
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật newsletter thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/seo
// Cập nhật SEO
module.exports.updateSEO = async (req, res) => {
  try {
    const {
      seoDefaultTitle,
      seoDefaultDescription,
      seoDefaultKeywords,
      googleAnalyticsId,
      googleTagManagerId,
      facebookPixelId,
    } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          seoDefaultTitle,
          seoDefaultDescription,
          seoDefaultKeywords,
          googleAnalyticsId,
          googleTagManagerId,
          facebookPixelId,
        },
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật SEO thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/v1/admin/site-config/settings
// Cập nhật settings
module.exports.updateSettings = async (req, res) => {
  try {
    const { maintenanceMode, maintenanceMessage, timezone } = req.body;

    const config = await SiteConfig.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          maintenanceMode,
          maintenanceMessage,
          timezone,
        },
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        message: "Không tìm thấy cấu hình",
      });
    }

    res.status(200).json({
      message: "Cập nhật settings thành công",
      data: config,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
