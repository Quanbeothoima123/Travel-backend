const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/type-of-person.controller");
router.get("/getAll", controller.getAll);
module.exports = router;
