const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/admin-account.controller");
// CRUD routes
router.get("/", controller.index);
router.post("/create", controller.create);
router.get("/detail/:id", controller.detail);
router.patch("/update/:id", controller.update);
router.delete("/delete/:id", controller.delete);
// Bulk actions (đặt trước :id routes)
router.patch("/bulk-status", controller.bulkUpdateStatus);
router.delete("/bulk-delete", controller.bulkDelete);

module.exports = router;
