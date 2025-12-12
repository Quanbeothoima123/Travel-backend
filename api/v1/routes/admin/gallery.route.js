const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/gallery.controller");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get(
  "/manager",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.index
);

router.patch(
  "/toggle-active/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.toggleActive
);

router.post(
  "/create",
  checkRole(["super-admin", "manager", "writter"]),
  controller.createGallery
);

router.post(
  "/generate-tags",
  checkRole(["super-admin", "manager", "writter"]),
  controller.generateTags
);

router.get(
  "/getAll",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getAllGalleries
);

router.get(
  "/detail/:id",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getGalleryById
);

router.get(
  "/infoToEdit/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.getGalleryForEdit
);

router.patch(
  "/update/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.updateGallery
);

router.delete(
  "/delete/:id",
  checkRole(["super-admin", "manager", "writter"]),
  controller.deleteGallery
);

module.exports = router;
