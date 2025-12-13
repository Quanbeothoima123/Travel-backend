const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/business-log.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// GET /api/v1/admin/business-log - Lấy danh sách logs
router.get("/", checkRole(["super-admin", "manager"]), controller.getAllLogs);

// GET /api/v1/admin/business-log/stats - Lấy thống kê
router.get(
  "/stats",
  checkRole(["super-admin", "manager"]),
  controller.getLogStats
);

// GET /api/v1/admin/business-log/models - Lấy danh sách models
router.get(
  "/models",
  checkRole(["super-admin", "manager"]),
  controller.getAvailableModels
);

// GET /api/v1/admin/business-log/actions - Lấy danh sách actions
router.get(
  "/actions",
  checkRole(["super-admin", "manager"]),
  controller.getAvailableActions
);

// GET /api/v1/admin/business-log/admins - Lấy danh sách admins
router.get(
  "/admins",
  checkRole(["super-admin", "manager"]),
  controller.getAvailableAdmins
);

// GET /api/v1/admin/business-log/:id - Lấy chi tiết một log
router.get(
  "/:id",
  checkRole(["super-admin", "manager"]),
  controller.getLogById
);

// DELETE /api/v1/admin/business-log/old - Xóa logs cũ (cần quyền cao)
router.delete(
  "/old",
  checkRole(["super-admin", "manager"]),
  controller.deleteOldLogs
);

module.exports = router;
