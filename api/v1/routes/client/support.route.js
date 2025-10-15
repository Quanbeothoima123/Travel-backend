// routes/supportClient.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/support.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");

router.post("/check-auth", checkAuth, controller.checkAuthStatus);
router.post("/create", checkAuth, controller.createConversation);
router.get("/:conversationId", checkAuth, controller.getConversationHistory);
router.post("/:conversationId/close", checkAuth, controller.closeConversation);
router.post("/:conversationId/feedback", checkAuth, controller.submitFeedback);

module.exports = router;
