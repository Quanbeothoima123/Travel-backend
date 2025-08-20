const { validateEmail } = require("../../utils/validate.helper");
const User = require("../../api/v1/models/user.model");
module.exports.validateRegisterUser = async (req, res, next) => {
  const { fullName, email, password } = req.body;
  let errors = [];

  if (!fullName || fullName.trim() === "") {
    errors.push({ field: "fullName", message: "Vui lòng nhập họ tên" });
  }

  // Email: phải đúng định dạng + chưa tồn tại
  errors.push(...(await validateEmail(email, { mustNotExist: true })));

  if (!password || password.trim() === "") {
    errors.push({ field: "password", message: "Vui lòng nhập mật khẩu" });
  } else if (password.length < 6) {
    errors.push({
      field: "password",
      message: "Mật khẩu phải có ít nhất 6 ký tự",
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Dữ liệu đăng ký không hợp lệ",
      errors,
    });
  }

  next();
};

module.exports.validateLogin = async (req, res, next) => {
  const { email } = req.body;
  let errors = [];

  // Email: phải đúng định dạng + phải tồn tại
  errors.push(...(await validateEmail(email, { mustExist: true })));

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Đăng nhập không thành công",
      errors,
    });
  }

  next();
};

module.exports.validateForgotPassword = async (req, res, next) => {
  const { email } = req.body;
  let errors = [];

  errors.push(...(await validateEmail(email, { mustExist: true })));

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors,
    });
  }

  next();
};

module.exports.validateOtpPassword = async (req, res, next) => {
  const { email, otp } = req.body;
  let errors = [];

  errors.push(...(await validateEmail(email, { mustExist: true })));

  if (!otp || otp.trim() === "") {
    errors.push({ field: "otp", message: "Vui lòng nhập otp!" });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors,
    });
  }

  next();
};

module.exports.validateResetPassword = async (req, res, next) => {
  const { userId, password } = req.body;
  let errors = [];

  if (!userId || userId.trim() === "") {
    errors.push({ field: "userId", message: "Vui lòng gửi lên userId!" });
  } else {
    const checkUserExist = await User.findOne({
      _id: userId,
      deleted: false,
      status: "active",
    });
    if (!checkUserExist) {
      errors.push({ field: "userId", message: "Tài khoản không tồn tại!" });
    }
  }

  if (!password || password.trim() === "") {
    errors.push({ field: "password", message: "Vui lòng nhập mật khẩu" });
  } else if (password.length < 6) {
    errors.push({
      field: "password",
      message: "Mật khẩu phải có ít nhất 6 ký tự",
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors,
    });
  }

  next();
};
