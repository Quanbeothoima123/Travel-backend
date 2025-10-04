const express = require("express");
const router = express.Router();

const controller = require("../../controllers/client/tour-category.controller");
router.get(
  "/get-tour-category-by-slug/:categorySlug",
  controller.getTourCategoryBySlug
);
router.get("/get-all-category", controller.getAllCategories);
module.exports = router;
