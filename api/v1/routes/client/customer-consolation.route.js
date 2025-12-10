const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/customer-consolation.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");
router.post(
  "/customer-consolation",
  checkAuth,
  controller.createCustomerConsolation
);

module.exports = router;
