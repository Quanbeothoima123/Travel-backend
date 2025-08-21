const User = require("../api/v1/models/user.model");

const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

/**
 * Validate email field
 * @param {string} email - Email cần kiểm tra
 * @param {Object} options - Các tùy chọn bổ sung
 * @param {boolean} options.required - Email bắt buộc
 * @param {boolean} options.mustExist - Email phải tồn tại trong hệ thống
 * @param {boolean} options.mustNotExist - Email không được tồn tại
 * @returns {Array} errors
 */
const validateEmail = async (email, options = {}) => {
  const { required = true, mustExist = false, mustNotExist = false } = options;
  let errors = [];

  if (!email || email.trim() === "") {
    if (required) {
      errors.push({
        field: "email",
        message: "Vui lòng nhập email",
      });
    }
  } else if (!emailRegex.test(email)) {
    errors.push({
      field: "email",
      message: "Email không hợp lệ",
    });
  } else {
    if (mustExist) {
      const user = await User.findOne({
        email,
        status: "active",
      });
      if (!user) {
        errors.push({
          field: "email",
          message: "Email không tồn tại trên hệ thống hoặc đã bị khóa",
        });
      }
    }

    if (mustNotExist) {
      const user = await User.findOne({ email });
      if (user) {
        errors.push({
          field: "email",
          message: "Email đã tồn tại trên hệ thống",
        });
      }
    }
  }

  return errors;
};

module.exports = {
  validateEmail,
};
