const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/invoice.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// GET: Lấy danh sách invoice với filter + pagination
router.get("/", checkRole(["super-admin", "manager"]), controller.index);

// GET: Lấy chi tiết một invoice
// router.get("/:id", checkRole(["super-admin", "manager"]), controller.detail);
router.get(
  "/detail/:invoiceId",
  checkRole(["super-admin", "manager"]),
  controller.getById
);
// POST: Tạo invoice mới (admin tạo cho khách)
router.post(
  "/create",
  checkRole(["super-admin", "manager"]),
  controller.create
);

// PATCH: Cập nhật trạng thái thanh toán
router.patch(
  "/update-status/:id",
  checkRole(["super-admin", "manager"]),
  controller.updateStatus
);

// PATCH: Cập nhật trạng thái tour
router.patch(
  "/update-tour-status/:id",
  checkRole(["super-admin", "manager"]),
  controller.updateTourStatus
);

// DELETE: Hủy booking
router.delete(
  "/cancel/:id",
  checkRole(["super-admin", "manager"]),
  controller.cancel
);

// GET: Thống kê tổng quan
router.get(
  "/statistics",
  checkRole(["super-admin", "manager"]),
  controller.statistics
);

// GET: Xuất dữ liệu
router.get(
  "/export",
  checkRole(["super-admin", "manager"]),
  controller.exportData
);

module.exports = router;
