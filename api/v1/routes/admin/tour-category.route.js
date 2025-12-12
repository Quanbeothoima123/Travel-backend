const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/tour-category.controller");
const tourCategoryValidate = require("../../../../validates/admin/tour-category.validate");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get(
  "/get-all-category",
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
  tourCategoryValidate.validateCreateCategory,
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
  tourCategoryValidate.validateUpdateCategory,
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
