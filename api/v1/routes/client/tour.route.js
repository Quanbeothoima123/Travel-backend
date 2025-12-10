const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/tour.controller");
router.get("/tour-list-domestic", controller.tourListDomestic);
router.get("/tour-list-aboard", controller.tourListAboard);
router.get("/get-all", controller.getAllTour);
router.get("/get-id-title", controller.getIdAndTitle);
router.get("/search", controller.searchTour);
router.get("/search-combined", controller.searchToursCombined);
router.get("/tour-detail/:slug", controller.detailTour);
router.get("/tour-list-by-category/:slug", controller.tourListByCategory);
router.get("/advanced-search/:categorySlug", controller.advancedSearchTours);

module.exports = router;
