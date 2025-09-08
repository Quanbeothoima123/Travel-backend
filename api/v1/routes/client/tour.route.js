const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/tour.controller");
router.get("/get-all", controller.getAllTour);
router.get("/search", controller.searchTour);
router.get("/search-combined", controller.searchToursCombined);
router.get("/tour-detail/:slug", controller.detailTour);
module.exports = router;
