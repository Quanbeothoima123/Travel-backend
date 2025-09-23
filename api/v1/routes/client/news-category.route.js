const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/new-category.controller");
router.get(
  "/get-news-category-by-slug/:newsCategorySlug",
  controller.getNewsCategoryBySlug
);

module.exports = router;
