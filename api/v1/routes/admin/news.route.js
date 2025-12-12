const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/news.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.post(
  "/create",
  checkRole(["super-admin", "manager", "writter"]),
  controller.create
);
router.get(
  "/published",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getPublishedNews
);
router.get(
  "/manager",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getNewsList
);
router.get(
  "/detail/:id",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getNewsById
);
router.delete(
  "/delete/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.deleteNews
);
router.get(
  "/news-categories",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getNewsCategories
);
router.get("/authors", controller.getAuthors);
router.get(
  "/get-data-for-edit/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.getNewsForEdit
);
router.patch(
  "/edit/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.updateNews
);
router.get(
  "/check-slug/:id",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.checkSlugAvailability
);
router.get(
  "/detail/:id",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getNewsDetail
);
router.get(
  "/update-status/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.updateNewsStatus
);
router.get(
  "/update-engagement/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.updateEngagement
);
module.exports = router;
