// routes/admin/ai.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/ai.controller");
/**
 * AI Content Generation Routes
 * Mỗi route riêng biệt cho từng loại content
 */
router.post("/generate-slug", controller.generateSlug);
router.post("/generate-excerpt", controller.generateExcerpt);
router.post("/generate-content", controller.generateContent);
router.post("/generate-metaTitle", controller.generateMetaTitle);
router.post("/generate-metaDescription", controller.generateMetaDescription);
router.post("/generate-tags", controller.generateTags);

module.exports = router;
