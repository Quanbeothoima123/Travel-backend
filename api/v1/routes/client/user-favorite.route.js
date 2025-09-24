const express = require("express");
const router = express.Router();
const { checkAuth } = require("../../../../middlewares/auth.middleware");
const controller = require("../../controllers/client/user-favorite.controller");
router.get(
  "/getStatusForNews/:targetId",
  checkAuth,
  controller.getStatusForNews
);
router.post("/add/:targetId", checkAuth, controller.addFavoriteForNews);
router.delete("/delete/:targetId", checkAuth, controller.deleteFavoriteForNews);
module.exports = router;
