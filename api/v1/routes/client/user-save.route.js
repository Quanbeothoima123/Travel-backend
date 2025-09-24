const express = require("express");
const router = express.Router();
const { checkAuth } = require("../../../../middlewares/auth.middleware");
const controller = require("../../controllers/client/user-save.controller");
router.get(
  "/getStatusForNews/:targetId",
  checkAuth,
  controller.getStatusForNews
);
router.post("/add/:targetId", checkAuth, controller.addSaveForNews);
router.delete("/delete/:targetId", checkAuth, controller.deleteSaveForNews);
module.exports = router;

module.exports = router;
