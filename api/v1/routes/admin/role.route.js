const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/role.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get("/", checkRole(["super-admin"]), controller.index);
router.get("/stats", checkRole(["super-admin"]), controller.getStats); // ← THÊM DÒNG NÀY
router.get("/detail/:id", checkRole(["super-admin"]), controller.detail);
router.post("/create", checkRole(["super-admin"]), controller.create);
router.patch("/update/:id", checkRole(["super-admin"]), controller.update);
router.delete("/delete/:id", checkRole(["super-admin"]), controller.delete);
router.patch(
  "/update-permissions",
  checkRole(["super-admin"]),
  controller.updatePermissions
);
router.get(
  "/permissions/matrix",
  checkRole(["super-admin"]),
  controller.getPermissionsMatrix
);
module.exports = router;
