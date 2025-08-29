const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/vehicle.controller");
router.get("/getAll", controller.getAll);
module.exports = router;
