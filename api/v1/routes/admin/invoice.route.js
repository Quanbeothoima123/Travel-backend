const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/invoice.controller");
// GET: Lấy danh sách invoice với filter + pagination
router.get("/", controller.index);

// GET: Lấy chi tiết một invoice
router.get("/:id", controller.detail);

// POST: Tạo invoice mới (admin tạo cho khách)
router.post("/create", controller.create);

// PATCH: Cập nhật trạng thái thanh toán
router.patch("/update-status/:id", controller.updateStatus);

// PATCH: Cập nhật trạng thái tour
router.patch("/update-tour-status/:id", controller.updateTourStatus);

// DELETE: Hủy booking
router.delete("/cancel/:id", controller.cancel);

// GET: Thống kê tổng quan
router.get("/statistics", controller.statistics);

// GET: Xuất dữ liệu
router.get("/export", controller.exportData);

module.exports = router;
