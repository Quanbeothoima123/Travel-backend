const express = require("express");
const router = express.Router();
const userValidate = require("../../../validates/user/user.validate");
const controller = require("../controllers/user.controller");
const { checkAuth } = require("../../../middlewares/auth.middleware");
router.post(
  "/register",
  userValidate.validateRegisterUser,
  controller.register
);
router.post("/auth", controller.auth);
router.post("/reAuth", controller.reAuth);
router.post("/reInfo", controller.reInfo);
router.post("/resendOtp", controller.resendOtp);
router.post("/login", userValidate.validateLogin, controller.login);
router.post("/logout", controller.logout);

router.get("/me", checkAuth, controller.getMe);

module.exports = router;
