const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/ward.controller");
router.get("/:provinceCode", controller.getWardsByProvince);
module.exports = router;
