const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/news.controller");

router.post("/create", controller.create);
router.get("/published", controller.getPublishedNews);
router.get("/manager", controller.getNewsList);
router.get("/detail/:id", controller.getNewsById);
router.delete("/delete/:id", controller.deleteNews);
router.get("/news-categories", controller.getNewsCategories);
router.get("/authors", controller.getAuthors);
router.get("/get-data-for-edit/:id", controller.getNewsForEdit);
router.patch("/edit/:id", controller.updateNews);
router.get("/check-slug/:id", controller.checkSlugAvailability);
router.get("/detail/:id", controller.getNewsDetail);
router.get("/update-status/:id", controller.updateNewsStatus);
router.get("/update-engagement/:id", controller.updateEngagement);
module.exports = router;
