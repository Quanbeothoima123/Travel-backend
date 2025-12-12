// user.route.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/user.controller");
router.get("/list", controller.getUserList);
router.get("/detail/:userId", controller.getUserDetail);
router.patch("/bulk-update-status", controller.bulkUpdateStatus);
router.patch("/update-status/:userId", controller.updateUserStatus);
router.get("/statistics", controller.getUserStatistics);
router.get("/export", controller.exportUsers);
module.exports = router;
