const express = require("express");
const router = express.Router();
const controller = require("../../controllers/client/news.controller");
const { checkAuth } = require("../../../../middlewares/auth.middleware");
// router.post("/create", controller.create);
router.get("/published", controller.getPublishedNews);
router.get("/news-list-by-category/:slug", controller.newsListByCategory);
router.get("/advanced-search/:newsCategorySlug", controller.advancedSearchNews);
router.get("/detail/:newsSlug", controller.detailNews);
router.patch("/update-views/:newsId", controller.updateNewsViews);

// ===== PROTECTED ROUTES (cần đăng nhập) =====
// Kiểm tra trạng thái yêu thích của 1 bài viết cụ thể
router.get("/favorites/check/:newsId", checkAuth, controller.checkFavorite);

// Lấy danh sách tất cả bài viết đã yêu thích của user
router.get("/favorites", checkAuth, controller.getUserFavorites);

// Thêm bài viết vào danh sách yêu thích
router.post("/favorites/:newsId", checkAuth, controller.addFavorite);

// Bỏ thích bài viết
router.delete("/favorites/:newsId", checkAuth, controller.removeFavorite);

module.exports = router;
