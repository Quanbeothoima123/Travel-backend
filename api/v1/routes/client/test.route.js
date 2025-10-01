const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/test.controller");

router.get("/ward", controller.ward);
router.get("/tour", controller.tourCategory);
router.get("/homePage", controller.homePage);
router.get("/service", controller.serviceCategory);
router.get("/news", controller.newsCategory);
router.get("/library", controller.libraryCategory);
router.get("/contact", controller.contactCategory);
router.get("/info", controller.infoCategory);
router.get("/tour-list-domestic", controller.tourListDomestic);
router.get("/tour-list-aboard", controller.tourListAboard);
router.get("/banner-list", controller.banner);
module.exports = router;
