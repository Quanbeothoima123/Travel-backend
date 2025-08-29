const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/customer-consolation.controller");
router.post("/customer-consolation", controller.createCustomerConsolation);

module.exports = router;
