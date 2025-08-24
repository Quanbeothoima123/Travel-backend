const express = require("express");
const router = express.Router();
const controller = require("../controllers/invoice.controller");
router.post("/invoice", controller.createInvoice);

module.exports = router;
