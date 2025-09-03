const mongoose = require("mongoose");
module.exports.validateCreateTour = async (req, res, next) => {
  next();
};

module.exports.validateUpdateCategory = async (req, res, next) => {
  const { id } = req.params;
  const { title, parentId, slug, active } = req.body;
  let errors = [];

  // Validate id
  if (!mongoose.Types.ObjectId.isValid(id)) {
    errors.push({ field: "id", message: "ID không hợp lệ" });
  }

  // Validate title
  if (title !== undefined) {
    if (title.trim() === "") {
      errors.push({ field: "title", message: "Tiêu đề không được để trống" });
    } else if (title.length < 3 || title.length > 100) {
      errors.push({
        field: "title",
        message: "Tiêu đề phải từ 3 đến 100 ký tự",
      });
    }
  }

  // Validate parentId
  if (parentId && parentId !== "") {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      errors.push({ field: "parentId", message: "parentId không hợp lệ" });
    }
  }

  // Validate slug (nếu người dùng nhập)
  if (slug !== undefined && slug.trim() === "") {
    errors.push({ field: "slug", message: "Slug không được để trống" });
  }

  // Validate active
  if (active !== undefined && typeof active !== "boolean") {
    errors.push({
      field: "active",
      message: "Trường active phải là true hoặc false",
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Dữ liệu cập nhật danh mục không hợp lệ",
      errors,
    });
  }

  next();
};
