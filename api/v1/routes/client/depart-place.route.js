const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/depart-place.controller");
router.get("/getAll", controller.getAll);
module.exports = router;
