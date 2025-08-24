const express = require("express");
const router = express.Router();
const controller = require("../controllers/customer-consolation.controller");
router.post("/customer-consolation", controller.createCustomerConsolation);

module.exports = router;
