const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/invoice.controller");
router.post("/payUsingCash", controller.createInvoice);
router.post("/pay-with-momo", controller.payWithMomo);
router.post("/momo-ipn", controller.momoIPN);
router.get("/:invoiceId", controller.getById);
module.exports = router;
