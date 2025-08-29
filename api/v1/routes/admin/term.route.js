const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/term.controller");
router.get("/getAll", controller.getAll);
module.exports = router;
