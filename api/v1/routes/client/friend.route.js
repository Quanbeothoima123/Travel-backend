const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/friend.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");

router.get("/list", checkAuth, controller.getFriends);

router.get("/suggestions", checkAuth, controller.getSuggestedFriends);

router.delete("/un-friend/:friendId", checkAuth, controller.unfriend);

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

router.get("/blocked/list", checkAuth, controller.getBlockedUsers);

router.post("/block", checkAuth, controller.blockUser);

router.post("/unblock", checkAuth, controller.unblockUser);

module.exports = router;
