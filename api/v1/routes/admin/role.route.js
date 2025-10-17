const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/role.controller");
router.get("/stats", controller.getStats); // ← THÊM DÒNG NÀY
router.get("/", controller.index);
router.get("/detail/:id", controller.detail);
router.post("/create", controller.create);
router.patch("/update/:id", controller.update);
router.delete("/delete/:id", controller.delete);
router.patch("/update-permissions", controller.updatePermissions);
router.get("/permissions/matrix", controller.getPermissionsMatrix);
module.exports = router;
