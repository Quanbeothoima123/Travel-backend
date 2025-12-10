// routes/supportClient.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/support.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");
// GET /api/v1/support/conversation - Get or create conversation
router.get("/conversation", checkAuth, controller.getOrCreateConversation);

// GET /api/v1/support/:conversationId/messages - Get messages
router.get("/:conversationId/messages", checkAuth, controller.getMessages);

module.exports = router;
