// routes/supportAdmin.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/support.controller");

router.get("/", controller.getAllConversations);
router.get(
  "/:conversationId",

  controller.getConversationDetailAdmin
);
router.patch("/:conversationId/join", controller.joinConversation);
router.patch(
  "/:conversationId/close",

  controller.closeConversationAdmin
);
router.patch(
  "/:conversationId/meta",

  controller.updateConversationMeta
);

module.exports = router;
