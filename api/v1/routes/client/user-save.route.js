const express = require("express");
const router = express.Router();
const { checkAuth } = require("../../../../middlewares/auth.middleware");
const controller = require("../../controllers/client/user-save.controller");

// Lấy trạng thái đã lưu
router.get("/status/:targetType/:targetId", checkAuth, controller.getStatus);

// Thêm hoặc xóa lưu
router.post("/:targetType/:targetId", checkAuth, controller.addSave);
router.delete("/:targetType/:targetId", checkAuth, controller.deleteSave);

module.exports = router;
