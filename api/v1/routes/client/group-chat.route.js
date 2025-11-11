// ========================================
// routes/group.route.js
// ========================================
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/group-chat.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");

// POST create group
router.post("/create", checkAuth, controller.createGroup);

// POST add members
router.post("/:conversationId/add-members", checkAuth, controller.addMembers);

// POST remove member
router.post(
  "/:conversationId/remove-member",
  checkAuth,
  controller.removeMember
);

// POST leave group
router.post("/:conversationId/leave", checkAuth, controller.leaveGroup);

// POST promote to admin
router.post("/:conversationId/promote", checkAuth, controller.promoteToAdmin);

// PATCH update group info
router.patch("/:conversationId/update", checkAuth, controller.updateGroupInfo);

// GET group detail
router.get("/:conversationId", checkAuth, controller.getGroupDetail);

module.exports = router;
