const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/type-of-person.controller");
router.get("/type-of-person", controller.getAllTypeOfPerson);
module.exports = router;
