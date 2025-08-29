const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/tour.controller");
router.get("/tour", controller.getTours);
router.patch("/tour/bulk-update", controller.bulkUpdateTours);
router.patch("/tour/:id", controller.updateTour);
module.exports = router;
