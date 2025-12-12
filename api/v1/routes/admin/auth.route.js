const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/auth.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.post("/login", controller.login);
router.post("/refresh-token", controller.refreshToken); // ← THÊM ROUTE NÀY
router.post("/logout", controller.logout); // ← Nếu chưa có thì thêm
router.get("/checkAuth", controller.checkAuth);
router.get("/", controller.getProfile);
router.patch(
  "/update",
  checkRole(["super-admin", "manager", "staff", "writter"]),
  controller.updateProfile
);
router.patch(
  "/change-password",
  checkRole(["super-admin", "manager", "staff", "writter"]),
  controller.changePassword
);
router.get(
  "/stats",
  checkRole(["super-admin", "manager", "staff", "writter"]),
  controller.getStats
);

module.exports = router;
