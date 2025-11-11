// routes/message.route.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/message.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");

// GET messages
router.get("/:conversationId", checkAuth, controller.getMessages);

// POST send message
router.post("/:conversationId", checkAuth, controller.sendMessage);

// DELETE message
router.delete("/:messageId", checkAuth, controller.deleteMessage);

// PATCH react to message
router.patch("/:messageId/react", checkAuth, controller.reactMessage);

// PATCH edit message
router.patch("/:messageId", checkAuth, controller.editMessage);

// POST mark as read
router.post("/:conversationId/mark-read", checkAuth, controller.markAsRead);

module.exports = router;
