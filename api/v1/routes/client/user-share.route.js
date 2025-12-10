const express = require("express");
const router = express.Router();
const { checkAuth } = require("../../../../middlewares/auth.middleware");
const controller = require("../../controllers/client/user-share.controller");

// Chia sẻ nội dung (news, product, v.v.)
router.post("/:targetType/:targetId", checkAuth, controller.addShare);

module.exports = router;
