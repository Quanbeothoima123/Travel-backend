// routes/admin/siteConfig.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/site-config.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// Lấy cấu hình chung
router.get("/", checkRole(["super-admin", "manager"]), controller.get);

// Tạo mới cấu hình (chỉ dùng lần đầu)
router.post(
  "/create",
  checkRole(["super-admin", "manager"]),
  controller.create
);

// Cập nhật toàn bộ
router.patch(
  "/update",
  checkRole(["super-admin", "manager"]),
  controller.update
);

// Cập nhật từng phần
router.patch(
  "/company-info",
  checkRole(["super-admin", "manager"]),
  controller.updateCompanyInfo
);
router.patch(
  "/branches",
  checkRole(["super-admin", "manager"]),
  controller.updateBranches
);
router.patch(
  "/branding",
  checkRole(["super-admin", "manager"]),
  controller.updateBranding
);
router.patch(
  "/social-media",
  checkRole(["super-admin", "manager"]),
  controller.updateSocialMedia
);
router.patch(
  "/contact-floating",
  checkRole(["super-admin", "manager"]),
  controller.updateContactFloating
);
router.patch(
  "/newsletter",
  checkRole(["super-admin", "manager"]),
  controller.updateNewsletter
);
router.patch(
  "/seo",
  checkRole(["super-admin", "manager"]),
  controller.updateSEO
);
router.patch(
  "/settings",
  checkRole(["super-admin", "manager"]),
  controller.updateSettings
);

module.exports = router;
