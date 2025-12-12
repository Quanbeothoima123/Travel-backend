const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/auth.controller");

router.post("/login", controller.login);
router.post("/refresh-token", controller.refreshToken); // ← THÊM ROUTE NÀY
router.post("/logout", controller.logout); // ← Nếu chưa có thì thêm
router.get("/checkAuth", controller.checkAuth);

module.exports = router;
