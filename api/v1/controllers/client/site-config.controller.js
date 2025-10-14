const SiteConfig = require("../../models/site-config.model");

// GET /api/v1/site-config
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
