const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/dashboard.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
// Trong file routes của bạn
router.get(
  "/overview",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getOverview
);
router.get(
  "/payment-methods",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getPaymentMethods
);
router.get(
  "/top-tours",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getTopTours
);
router.get(
  "/top-customers",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getTopCustomers
);
router.get(
  "/user-analytics",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getUserAnalytics
);
router.get(
  "/latest-news",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getLatestNews
);
router.get(
  "/latest-tours",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getLatestTours
);
router.get(
  "/recent-activities",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getRecentActivities
);
router.get(
  "/revenue-metrics",
  checkRole(["super-admin", "manager", "viewer"]),
  controller.getRevenueMetrics
);
module.exports = router;
