// routes/admin/aboutUs.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/about-us.controller");

// GET - Lấy thông tin About Us
router.get("/", controller.get);

// POST - Tạo hoặc cập nhật
router.post("/createOrUpdate", controller.createOrUpdate);

// PATCH - Toggle active
router.patch("/toggle-active", controller.toggleActive);

// DELETE - Xóa (cẩn thận!)
router.delete("/delete", controller.delete);

module.exports = router;
