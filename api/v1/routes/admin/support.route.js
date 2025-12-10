// routes/admin/support.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/support.controller");
// GET /api/v1/admin/support - Get all conversations
router.get("/", controller.getAllConversations);

// GET /api/v1/admin/support/:conversationId - Get conversation detail
router.get("/:conversationId", controller.getConversationDetailAdmin);

module.exports = router;
