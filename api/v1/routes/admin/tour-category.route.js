const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/tour-category.controller");
const tourCategoryValidate = require("../../../../validates/admin/tour-category.validate");
router.get("", controller.getAllCategories);
router.get("/recent", controller.getRecentCategories);
router.post(
  "/create",
  tourCategoryValidate.validateCreateCategory,
  controller.createCategory
);
router.get("/detail/:id", controller.getCategoryById);
router.patch(
  "/update/:id",
  tourCategoryValidate.validateUpdateCategory,
  controller.updateCategory
);
router.delete("/delete/:id", controller.deleteCategory);

module.exports = router;
