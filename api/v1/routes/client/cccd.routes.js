// routes/cccd.routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const controller = require("../../controllers/client/cccd.controller");

// Cấu hình Multer để lưu file tạm
const upload = multer({
  dest: path.join(__dirname, "../../../../uploads/"),
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  },
  fileFilter: (req, file, cb) => {
    // Chỉ chấp nhận ảnh
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (JPG, PNG)"));
    }
  },
});

// Route: Upload và OCR CCCD
router.post(
  "/extract-cccd",
  upload.single("cccdImage"),
  controller.extractCccdInfo
);

module.exports = router;
