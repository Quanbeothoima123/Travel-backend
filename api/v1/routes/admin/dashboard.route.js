const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/dashboard.controller");
// Trong file routes của bạn
router.get("/overview", controller.getOverview);
router.get("/payment-methods", controller.getPaymentMethods);
router.get("/top-tours", controller.getTopTours);
router.get("/top-customers", controller.getTopCustomers);
router.get("/user-analytics", controller.getUserAnalytics);
router.get("/latest-news", controller.getLatestNews);
router.get("/latest-tours", controller.getLatestTours);
router.get("/recent-activities", controller.getRecentActivities);
router.get("/revenue-metrics", controller.getRevenueMetrics);
module.exports = router;
