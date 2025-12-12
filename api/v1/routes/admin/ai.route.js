// routes/admin/ai.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/ai.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
/**
 * AI Content Generation Routes
 * Mỗi route riêng biệt cho từng loại content
 */
router.post(
  "/generate-slug",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateSlug
);
router.post(
  "/generate-excerpt",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateExcerpt
);
router.post(
  "/generate-content",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateContent
);
router.post(
  "/generate-metaTitle",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateMetaTitle
);
router.post(
  "/generate-metaDescription",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateMetaDescription
);
router.post(
  "/generate-tags",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateTags
);

module.exports = router;
