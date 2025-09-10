const md5 = require("md5");
const User = require("../../models/user.model");
const Otp = require("../../models/otp.model"); // nhớ import Otp
const Ward = require("../../models/ward.model");
const Province = require("../../models/province.model");
const sendOtp = require("../../../../helpers/otpGenerator");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
// [POST] /api/v1/user/register
module.exports.register = async (req, res) => {
  try {
    const email = req.body.email;
    const emailExist = await User.findOne({ email: email });

    if (emailExist) {
      return res.json({
        code: 400,
        message:
          "Tài khoản của bạn đã đăng kí!, Nếu chưa xác thực hãy bấm nút xác thực tài khoản phía dưới!",
        userId: "",
        email: req.body.email,
        type: "register", // 👈 Thêm type để phân biệt
      });
    }
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

    // Nếu OTP đúng, cập nhật user thành activer
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

// [POST] /api/v1/user/reAuth
module.exports.reAuth = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Thiếu email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email không tồn tại" });
    }
    if (user.status === "active") {
      return res.status(404).json({
        message: "Tài khoản đã xác thực vui lòng không lảng vảng ở đây!",
      });
    }

    // Xóa OTP cũ
    await Otp.deleteMany({ userId: user._id });

    // Gửi lại OTP mới
    const subject = "Mã xác thực lại tài khoản";
    await sendOtp.generateAndSendOtp(user._id, subject, email);

    return res.json({
      code: 200,
      message: "OTP mới đã được gửi, vui lòng kiểm tra email",
      userId: user._id,
      email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/reInfo
module.exports.reInfo = async (req, res) => {
  try {
    const { userId, fullName, password } = req.body;

    if (!userId || !fullName || !password) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    // Hash password mới
    const hashPass = md5(password);

    // Update user info
    await User.findByIdAndUpdate(userId, {
      fullName,
      password: hashPass,
      status: "active",
    });

    return res.json({
      code: 200,
      message: "Cập nhật thông tin & xác thực thành công",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/login
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("password fullName");

    if (!user || md5(password) !== user.password) {
      return res.json({
        code: 400,
        message: "Sai mật khẩu hoặc tài khoản",
      });
    }

    // Tạo JWT
    const token = jwt.sign(
      { userId: user._id, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: "7d" } // token sống 7 ngày
    );

    // Set cookie (httpOnly để bảo mật hơn)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: false, // true nếu dùng HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      code: 200,
      message: "Đăng nhập thành công",
      token,
      fullName: user.fullName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
// [GET] /api/v1/user/me
module.exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("fullName email");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports.logout = (req, res) => {
  res.clearCookie("authToken");
  return res.json({ message: "Đăng xuất thành công" });
};
// [POST] /api/v1/user/user-profile
module.exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // từ token decode
    const user = await User.findById(userId)
      .populate("province")
      .populate("ward")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "Có lỗi trong quá trình lấy thông tin" });
    }
    const { password, ...rest } = user;
    res.json(rest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/update-profile
module.exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      fullName,
      birthDay,
      sex,
      phone,
      avatar,
      address,
      province: provinceId,
      ward: wardId,
    } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    if (fullName !== undefined) user.fullName = fullName;
    if (birthDay !== undefined) user.birthDay = new Date(birthDay);
    if (sex !== undefined) user.sex = sex;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (address !== undefined) user.address = address;

    // Xử lý province & ward
    if (provinceId) {
      const province = await Province.findById(provinceId);
      if (!province)
        return res.status(400).json({ message: "Tỉnh/Thành không hợp lệ" });
      user.province = province._id;

      // Nếu ward được gửi
      if (wardId) {
        const ward = await Ward.findById(wardId);
        if (!ward || ward.parent_code !== province.code)
          return res
            .status(400)
            .json({ message: "Phường/Xã không hợp lệ cho tỉnh/thành này" });
        user.ward = ward._id;
      } else {
        user.ward = undefined;
      }
    } else if (wardId) {
      if (!user.province)
        return res.status(400).json({ message: "Chọn tỉnh/thành trước" });
      const province = await Province.findById(user.province);
      const ward = await Ward.findById(wardId);
      if (!ward || ward.parent_code !== province.code)
        return res.status(400).json({ message: "Phường/Xã không hợp lệ" });
      user.ward = ward._id;
    }

    await user.save();

    const { password, ...rest } = user.toObject();
    res.json({ message: "Cập nhật thành công", user: rest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
