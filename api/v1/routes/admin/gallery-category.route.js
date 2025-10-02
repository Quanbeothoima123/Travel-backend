const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/gallery-category.controller");
const galleryCategoryValidate = require("../../../../validates/admin/gallery-category.validate");
router.get("/getAll", controller.getAllCategories);
router.get("/recent", controller.getRecentCategories);
router.post(
  "/create",
  galleryCategoryValidate.validateCreateCategory,
  controller.createCategory
);
router.get("/detail/:id", controller.getCategoryById);
router.patch(
  "/update/:id",
  galleryCategoryValidate.validateUpdateCategory,
  controller.updateCategory
);
router.get("/delete-info/:id", controller.getDeleteCategoryInfo);
router.delete("/delete/:id", controller.deleteCategory);
router.get("/last-updated", controller.getLatestUpdatedCategory);
router.get("/last-created", controller.getLatestCreatedCategory);
module.exports = router;
