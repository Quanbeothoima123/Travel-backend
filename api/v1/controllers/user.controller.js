const md5 = require("md5");
const User = require("../models/user.model");
const Otp = require("../models/otp.model"); // nhớ import Otp
const sendOtp = require("../../../helpers/otpGenerator");

// [POST] /api/v1/user/register
module.exports.register = async (req, res) => {
  try {
    const user = {
      fullName: req.body.fullName,
      email: req.body.email,
      password: md5(req.body.password),
    };

    const userSave = new User(user);
    await userSave.save();

    const subject = "Mã xác thực đăng ký tài khoản";
    await sendOtp.generateAndSendOtp(userSave.id, subject, req.body.email);

    return res.json({
      code: 200,
      message: "Vui lòng nhập mã xác thực để hoàn tất đăng kí tài khoản",
      userId: userSave.id,
      email: req.body.email,
      type: "register", // 👈 Thêm type để phân biệt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// [POST] /api/v1/user/auth
module.exports.auth = async (req, res) => {
  try {
    const { userId, otp, type } = req.body;

    const otpRecord = await Otp.findOne({ userId }).select("code expireAt");

    if (!otpRecord) {
      return res
        .status(400)
        .json({ message: "OTP không tồn tại hoặc đã hết hạn", type });
    }

    if (otpRecord.expireAt < new Date()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn", type });
    }

    if (otpRecord.code !== otp) {
      return res.status(400).json({ message: "Mã OTP không chính xác", type });
    }

    // Nếu OTP đúng, cập nhật user thành active
    await User.updateOne({ _id: userId }, { status: "active" });

    // Xoá OTP đã dùng
    await Otp.deleteMany({ userId });

    return res.json({
      code: 200,
      message: "Xác thực thành công",
      userId,
      type, // 👈 Giữ lại type để frontend biết đang xử lý gì
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/resendOtp
module.exports.resendOtp = async (req, res) => {
  try {
    const { userId, email, type } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        message: "Thiếu thông tin userId hoặc email",
        type,
      });
    }

    // Xóa OTP cũ
    await Otp.deleteMany({ userId });

    // Gửi OTP mới
    const subject =
      type === "register"
        ? "Mã xác thực đăng ký tài khoản (gửi lại)"
        : "Mã OTP xác thực (gửi lại)";
    await sendOtp.generateAndSendOtp(userId, subject, email);

    return res.json({
      code: 200,
      message: "OTP mới đã được gửi, vui lòng kiểm tra email",
      userId,
      email,
      type, // 👈 frontend nhận để biết resend cho flow nào
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
