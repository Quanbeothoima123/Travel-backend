const express = require("express");
const router = express.Router();
const userValidate = require("../../../../validates/client/user.validate");
const controller = require("../../controllers/client/user.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");
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
router.get("/profile", checkAuth, controller.getUserProfile);
router.patch("/profile", checkAuth, controller.updateUserProfile);

router.post("/profile/setup", checkAuth, controller.setupProfile);

router.get("/friends", checkAuth, controller.getFriends);

router.get("/friends/suggestions", checkAuth, controller.getSuggestedFriends);

router.delete("/friends/:friendId", checkAuth, controller.unfriend);

router.get(
  "/friend-requests/received",
  checkAuth,
  controller.getFriendRequestsReceived
);

router.get(
  "/friend-requests/sent",
  checkAuth,
  controller.getFriendRequestsSent
);

router.post("/friend-requests/send", checkAuth, controller.sendFriendRequest);

router.post(
  "/friend-requests/accept",
  checkAuth,
  controller.acceptFriendRequest
);

router.post(
  "/friend-requests/reject",
  checkAuth,
  controller.rejectFriendRequest
);

router.delete(
  "/friend-requests/cancel",
  checkAuth,
  controller.cancelSentRequest
);

router.get("/blocked", checkAuth, controller.getBlockedUsers);

router.post("/block", checkAuth, controller.blockUser);

router.post("/unblock", checkAuth, controller.unblockUser);

module.exports = router;
