const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/gallery-category.controller");
const galleryCategoryValidate = require("../../../../validates/admin/gallery-category.validate");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get(
  "/getAll",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getAllCategories
);
router.get(
  "/recent",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getRecentCategories
);
router.post(
  "/create",
  checkRole(["super-admin", "manager"]),
  galleryCategoryValidate.validateCreateCategory,
  controller.createCategory
);
router.get(
  "/detail/:id",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getCategoryById
);
router.patch(
  "/update/:id",
  checkRole(["super-admin", "manager"]),
  galleryCategoryValidate.validateUpdateCategory,
  controller.updateCategory
);
router.get(
  "/delete-info/:id",
  checkRole(["super-admin", "manager"]),
  controller.getDeleteCategoryInfo
);
router.delete(
  "/delete/:id",
  checkRole(["super-admin", "manager"]),
  controller.deleteCategory
);
router.get(
  "/last-updated",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getLatestUpdatedCategory
);
router.get(
  "/last-created",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getLatestCreatedCategory
);
module.exports = router;
