const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/invoice.controller");
router.get("/:invoiceId", controller.getById);

module.exports = router;
