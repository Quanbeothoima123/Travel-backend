const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/admin-account.controller");
router.post("/login", controller.login);
router.get("/checkAuth", controller.checkAuth);
module.exports = router;
