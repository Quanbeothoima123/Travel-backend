const express = require("express");
const router = express.Router();
const controller = require("../controllers/test.controller");

router.get("/province", controller.province);
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
router.get("/tour-detail/:slug", controller.detailTour);
router.get("/tour-list-by-category/:slug", controller.tourListByCategory);
module.exports = router;
