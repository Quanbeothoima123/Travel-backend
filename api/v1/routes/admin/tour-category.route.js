const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/tour-category.controller");
const tourCategoryValidate = require("../../../../validates/admin/tour-category.validate");
router.get("/get-all-category", controller.getAllCategories);
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
router.get("/delete-info/:id", controller.getDeleteCategoryInfo);
router.delete("/delete/:id", controller.deleteCategory);
router.get("/last-updated", controller.getLatestUpdatedCategory);
router.get("/last-created", controller.getLatestCreatedCategory);
module.exports = router;
