const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/user.controller");
router.post("/register", controller.register);
router.post("/verify-otp", controller.verifyOtp);
router.post("/login", controller.login);
router.post("/logout", controller.logout);
router.post("/refresh-token", controller.refreshToken);
router.post("/resend-otp", controller.resendOtp);
router.post("/reauth", controller.reAuth);
router.post("/reinfo", controller.reInfo);

module.exports = router;
