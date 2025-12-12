// routes/admin/support.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/support.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// GET /api/v1/admin/support - Get all conversations
router.get(
  "/",
  checkRole(["super-admin", "manager", "staff"]),
  controller.getAllConversations
);

// GET /api/v1/admin/support/:conversationId - Get conversation detail
router.get(
  "/:conversationId",
  checkRole(["super-admin", "manager", "staff"]),
  controller.getConversationDetailAdmin
);

module.exports = router;
