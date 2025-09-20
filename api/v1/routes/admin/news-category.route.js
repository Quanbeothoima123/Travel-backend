const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/new-category.controller");
const newsCategoryValidate = require("../../../../validates/admin/news-category.validate");
router.get("/getAll", controller.getAllNewCategories);
router.post(
  "/create",
  newsCategoryValidate.validateCreateCategory,
  controller.createCategory
);
router.get("/detail/:id", controller.getCategoryById);

router.patch(
  "/update/:id",
  newsCategoryValidate.validateUpdateCategory,
  controller.updateCategory
);
router.get("/get-by-id/:id", controller.getById);
router.get("/delete-info/:id", controller.getDeleteCategoryInfo);
router.delete("/delete/:id", controller.deleteCategory);
router.get("/last-updated", controller.getLatestUpdatedCategory);
router.get("/last-created", controller.getLatestCreatedCategory);
module.exports = router;
