const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/vehicle.controller");
router.get("/getAll", controller.getAll);
module.exports = router;
