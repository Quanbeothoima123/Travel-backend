const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/tour.controller");
const validate = require("../../../../validates/admin/tour.validate");
const { checkRole } = require("../../../../middlewares/admin/authAdmin");
router.get(
  "/get-all-tour",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getTours
);
router.get(
  "/get-all-tour-advanced",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getToursAdvanced
);
router.get(
  "/get-id-title",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getIdAndTitle
);
router.patch(
  "/bulk-update",
  checkRole(["super-admin", "manager"]),
  controller.bulkUpdateTours
);
router.patch(
  "/update-status-single/:id",
  checkRole(["super-admin", "viewer"]),
  controller.updateTour
);
router.post(
  "/create",
  checkRole(["super-admin", "manager"]),
  validate.validateCreateTour,
  controller.createTour
);
router.post(
  "/check-info-tour-create",
  checkRole(["super-admin", "manager"]),
  controller.checkTour
);
router.post(
  "/check-info-tour-edit/:tourId",
  checkRole(["super-admin", "manager"]),
  controller.checkTourEdit
);
router.get(
  "/countTours",
  checkRole(["super-admin", "manager"]),
  controller.countTours
);
router.post(
  "/generate-tags-ai",
  checkRole(["super-admin", "manager"]),
  controller.generateTagUsingAI
);
router.post(
  "/generate-slug-ai",
  checkRole(["super-admin", "manager"]),
  controller.generateSlugUsingAI
);
router.get(
  "/getTourById/:tourId",
  checkRole(["super-admin", "manager", "staff", "writter", "viewer"]),
  controller.getTourById
);
router.delete(
  "/delete/:tourId",
  checkRole(["super-admin", "manager"]),
  controller.delete
);
router.patch(
  "/update/:tourId",
  checkRole(["super-admin", "manager"]),
  validate.validateUpdateTour,
  controller.editTour
);
module.exports = router;
