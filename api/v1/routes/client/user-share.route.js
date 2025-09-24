const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/user-share.controller");
router.post("/add/:targetId", controller.addShareForNews);
module.exports = router;
