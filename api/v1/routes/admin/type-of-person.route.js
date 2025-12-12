const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/type-of-person.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get(
  "/getAll",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getAll
);
module.exports = router;
