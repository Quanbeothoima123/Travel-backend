const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/gallery.controller");
const checkAuthAdmin = require("../../../../middlewares/admin/authAdmin");

router.get("/manager", controller.index);

router.patch("/toggle-active/:id", controller.toggleActive);

router.post("/create", checkAuthAdmin, controller.createGallery);

router.post("/generate-tags", controller.generateTags);

router.get("/getAll", controller.getAllGalleries);

router.get("/detail/:id", controller.getGalleryById);

router.get("/infoToEdit/:id", controller.getGalleryForEdit);

router.patch("/update/:id", controller.updateGallery);

router.delete("/delete/:id", checkAuthAdmin, controller.deleteGallery);

module.exports = router;
