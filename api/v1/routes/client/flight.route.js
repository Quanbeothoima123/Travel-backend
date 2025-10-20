const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/flight.controller");

// Tìm kiếm sân bay (autocomplete)
router.get("/airports/search", controller.searchAirports);

// Lấy sân bay gần nhất
router.get("/airports/nearest", controller.getNearestAirport);

// Tìm kiếm chuyến bay
router.get("/flights/search", controller.searchFlights);

// Lấy giá chi tiết chuyến bay
router.post("/flights/pricing", controller.getFlightPrice);

module.exports = router;
