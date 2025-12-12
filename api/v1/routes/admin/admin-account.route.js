const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/admin-account.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// CRUD routes
router.get("/", checkRole(["super-admin"]), controller.index);
router.post("/create", checkRole(["super-admin"]), controller.create);
router.get("/detail/:id", checkRole(["super-admin"]), controller.detail);
router.patch("/update/:id", checkRole(["super-admin"]), controller.update);
router.delete("/delete/:id", checkRole(["super-admin"]), controller.delete);
// Bulk actions (đặt trước :id routes)
router.patch(
  "/bulk-status",
  checkRole(["super-admin"]),
  controller.bulkUpdateStatus
);
router.delete(
  "/bulk-delete",
  checkRole(["super-admin"]),
  controller.bulkDelete
);

module.exports = router;
