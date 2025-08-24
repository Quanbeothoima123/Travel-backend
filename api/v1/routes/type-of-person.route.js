const express = require("express");
const router = express.Router();
const controller = require("../controllers/type-of-person.controller");
router.post("/type-of-person", controller.getAllTypeOfPerson);
module.exports = router;
