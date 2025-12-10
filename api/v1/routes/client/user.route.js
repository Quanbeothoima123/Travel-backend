const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/user.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");
router.get("/me", checkAuth, controller.getMe);
router.get("/profile", checkAuth, controller.getUserProfile);
router.patch("/profile", checkAuth, controller.updateUserProfile);

module.exports = router;
