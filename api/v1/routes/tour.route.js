const express = require("express");
const router = express.Router();
const controller = require("../controllers/tour.controller");
const controllerAdmin = require("../controllers/admin/tour.controller");
router.get("/get-all", controller.getAllTour);
router.get("/search", controller.searchTour);
router.get("/search-combined", controller.searchToursCombined);

router.get("/tour", controllerAdmin.getTours);
router.patch("/tour/bulk-update", controllerAdmin.bulkUpdateTours);
router.patch("/tour/:id", controllerAdmin.updateTour);
module.exports = router;
