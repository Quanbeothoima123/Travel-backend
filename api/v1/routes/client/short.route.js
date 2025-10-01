const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/short.controller");
const hlsProxyController = require("../../controllers/hlsProxy.controller"); // THÊM DÒNG NÀY
const multerErrorHandler = require("../../../../middlewares/multerErrorHandler");
const { checkAuth } = require("../../../../middlewares/auth.middleware");

// === HLS PROXY ROUTES (đặt ở đầu để ưu tiên) ===
router.get("/playlist/:shortId", hlsProxyController.proxyPlaylist);
router.get("/segment/:shortId/:segmentName", hlsProxyController.proxySegment);

// === PUBLIC ROUTES ===
router.get("/getShorts", controller.getShorts);
router.get("/trending/list", controller.getTrendingShorts);
router.get("/search/query", controller.searchShorts);
router.get("/user/:userId", controller.getShortsByUser);

// Route lấy URL video
router.get("/video/:shortId", controller.getVideoUrl);

// Route chi tiết short (đặt sau các route cụ thể)
router.get("/:shortId", controller.getShortById);

// Tăng view count
router.post("/:shortId/view", controller.incrementView);

// === PROTECTED ROUTES ===
router.post(
  "/upload",
  checkAuth,
  controller.upload,
  multerErrorHandler,
  controller.uploadShort
);

router.get("/status/:shortId", checkAuth, controller.getProcessingStatus);

module.exports = router;
