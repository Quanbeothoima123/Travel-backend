const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/gallery-category.controller");
router.get("/getAll", controller.getAllCategories);
router.get("/by-slug/:slug", controller.getCategoryBySlug);
module.exports = router;
