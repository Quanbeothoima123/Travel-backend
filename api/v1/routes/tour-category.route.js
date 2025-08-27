const express = require("express");
const router = express.Router();
const controller = require("../controllers/tour-category.controller");
router.get("", controller.getAllCategories);
router.get("/recent", controller.getRecentCategories); // recent?type=created|updated
router.post("/create", controller.createCategory);
router.get("/detail/:id", controller.getCategoryById);
router.patch("/update/:id", controller.updateCategory);
router.delete("/delete/:id", controller.deleteCategory);

module.exports = router;
