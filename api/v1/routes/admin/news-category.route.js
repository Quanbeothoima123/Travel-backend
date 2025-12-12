const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/new-category.controller");
const newsCategoryValidate = require("../../../../validates/admin/news-category.validate");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get(
  "/getAll",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getAllNewCategories
);
router.post(
  "/create",
  checkRole(["super-admin", "manager"]),
  newsCategoryValidate.validateCreateCategory,
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
  newsCategoryValidate.validateUpdateCategory,
  controller.updateCategory
);
router.get("/get-by-id/:id", controller.getById);
router.get(
  "/delete-info/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.getDeleteCategoryInfo
);
router.delete(
  "/delete/:id",
  checkRole(["super-admin", "manager", "writter"]),
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
