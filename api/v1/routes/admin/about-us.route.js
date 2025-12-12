// routes/admin/aboutUs.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/about-us.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// GET - Lấy thông tin About Us
router.get("/", checkRole(["super-admin", "manager"]), controller.get);

// POST - Tạo hoặc cập nhật
router.post(
  "/createOrUpdate",
  checkRole(["super-admin", "manager"]),
  controller.createOrUpdate
);

// PATCH - Toggle active
router.patch(
  "/toggle-active",
  checkRole(["super-admin", "manager"]),
  controller.toggleActive
);

// DELETE - Xóa (cẩn thận!)
router.delete(
  "/delete",
  checkRole(["super-admin", "manager"]),
  controller.delete
);

module.exports = router;
