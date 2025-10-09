// routes/admin/siteConfig.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/site-config.controller");

// Lấy cấu hình chung
router.get("/", controller.get);

// Tạo mới cấu hình (chỉ dùng lần đầu)
router.post("/create", controller.create);

// Cập nhật toàn bộ
router.patch("/update", controller.update);

// Cập nhật từng phần
router.patch("/company-info", controller.updateCompanyInfo);
router.patch("/branches", controller.updateBranches);
router.patch("/branding", controller.updateBranding);
router.patch("/social-media", controller.updateSocialMedia);
router.patch("/contact-floating", controller.updateContactFloating);
router.patch("/newsletter", controller.updateNewsletter);
router.patch("/seo", controller.updateSEO);
router.patch("/settings", controller.updateSettings);

module.exports = router;
