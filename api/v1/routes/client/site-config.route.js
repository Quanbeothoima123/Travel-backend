// routes/admin/siteConfig.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/site-config.controller");

// Lấy cấu hình chung
router.get("/", controller.get);
module.exports = router;
