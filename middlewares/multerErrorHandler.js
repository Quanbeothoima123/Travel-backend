// middleware/multerErrorHandler.js

const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    // Multer file size error
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File quá lớn! Kích thước tối đa là 20MB",
        maxSize: "20MB",
        error: "FILE_TOO_LARGE",
      });
    }

    // Multer unexpected field error
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        message: "Field upload không hợp lệ",
        error: "INVALID_FIELD",
      });
    }

    // Custom file filter error
    if (err.message === "Chỉ chấp nhận file video!") {
      return res.status(400).json({
        message: err.message,
        error: "INVALID_FILE_TYPE",
        allowedTypes: ["mp4", "mov", "avi", "mkv", "flv", "wmv"],
      });
    }

    // Other multer errors
    return res.status(400).json({
      message: err.message || "Lỗi khi upload file",
      error: "UPLOAD_ERROR",
    });
  }

  next();
};

module.exports = multerErrorHandler;
