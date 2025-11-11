// ========================================
// routes/conversation.route.js
// ========================================
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/conversation.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");

// GET conversation list
router.get("/", checkAuth, controller.getConversationList);

// POST create or get private conversation
router.post("/create-or-get", checkAuth, controller.createOrGetConversation);

// GET conversation detail
router.get("/:conversationId", checkAuth, controller.getConversationDetail);

// PATCH set nickname (private chat only)
router.patch("/:conversationId/nickname", checkAuth, controller.setNickname);

// DELETE conversation (soft delete)
router.delete("/:conversationId", checkAuth, controller.deleteConversation);

module.exports = router;
