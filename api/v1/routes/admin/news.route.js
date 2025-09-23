const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/news.controller");
router.post("/create", controller.create);
router.get("/published", controller.getPublishedNews);

module.exports = router;
