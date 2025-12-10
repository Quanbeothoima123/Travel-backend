const bcrypt = require("bcrypt");
const User = require("../../models/user.model");
const Otp = require("../../models/otp.model");
const RefreshTokenUser = require("../../models/refresh-token-user.model");
const Ward = require("../../models/ward.model");
const Province = require("../../models/province.model");
const sendOtp = require("../../../../helpers/otpGenerator");
const telegramBot = require("../../../../helpers/telegramBot");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES = "15m"; // 15 phút
const REFRESH_TOKEN_EXPIRES = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const SALT_ROUNDS = 10;

// Hàm tạo Access Token với FULL user info
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      userName: user.userName,
      customName: user.customName,
      avatar: user.avatar,
      phone: user.phone,
      sex: user.sex,
      birthDay: user.birthDay,
      address: user.address,
      province: user.province,
      ward: user.ward,
      status: user.status,
      isAnonymous: user.isAnonymous,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
};

// Hàm tạo Refresh Token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

// Validation helper
const validateRegisterData = (data) => {
  const errors = [];

  // Validate fullName
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push("Họ tên phải có ít nhất 2 ký tự");
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push("Email không hợp lệ");
  }

  // Validate password
  if (!data.password || data.password.length < 6) {
    errors.push("Mật khẩu phải có ít nhất 6 ký tự");
  }

  // Validate birthDay
  if (!data.birthDay) {
    errors.push("Ngày sinh là bắt buộc");
  } else {
    const birthDate = new Date(data.birthDay);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 13 || age > 120) {
      errors.push("Tuổi phải từ 13 đến 120");
    }
  }

  // Validate sex
  if (!data.sex || !["Nam", "Nữ", "Khác"].includes(data.sex)) {
    errors.push("Giới tính không hợp lệ");
  }

  // Validate address
  if (!data.address || data.address.trim().length < 5) {
    errors.push("Địa chỉ phải có ít nhất 5 ký tự");
  }

  return errors;
};
//[POST] api/v1/auth/register
module.exports.register = async (req, res) => {
  try {
    // Validate input data
    const validationErrors = validateRegisterData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        code: 400,
        message: validationErrors.join(", "),
        errors: validationErrors,
      });
    }

    const email = req.body.email.toLowerCase().trim();
    const emailExist = await User.findOne({ email: email });

    if (emailExist) {
      return res.json({
        code: 400,
        message:
          "Tài khoản của bạn đã đăng ký! Nếu chưa xác thực hãy bấm nút xác thực tài khoản phía dưới!",
        userId: emailExist.id,
        email: email,
        type: "register",
      });
    }

    // Hash password với bcrypt
    const hashedPassword = await bcrypt.hash(req.body.password, SALT_ROUNDS);

    // Prepare user data
    const user = {
      fullName: req.body.fullName.trim(),
      email: email,
      password: hashedPassword,
      birthDay: new Date(req.body.birthDay),
      sex: req.body.sex,
      address: req.body.address.trim(),
      status: "initial",
    };

    const userSave = new User(user);
    await userSave.save();

    const subject = "Mã xác thực đăng ký tài khoản";
    await sendOtp.generateAndSendOtp(userSave.id, subject, email);

    return res.json({
      code: 200,
      message: "Vui lòng nhập mã xác thực để hoàn tất đăng ký tài khoản",
      userId: userSave.id,
      email: email,
      type: "register",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      code: 500,
      message: "Lỗi server khi đăng ký",
    });
  }
};
// [POST] /api/v1/verify-otp
module.exports.verifyOtp = async (req, res) => {
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

    await User.updateOne({ _id: userId }, { status: "active" });
    await Otp.deleteMany({ userId });

    const user = await User.findById(userId).select(
      "fullName email phone createdAt"
    );
    if (user) {
      telegramBot
        .notifyUserRegistration({
          userId: user._id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          createdAt: user.createdAt,
        })
        .catch((err) => {
          console.error("⚠️ Không thể gửi thông báo Telegram:", err.message);
        });
    }

    return res.json({
      code: 200,
      message: "Xác thực thành công",
      userId,
      type,
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

    await Otp.deleteMany({ userId });

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
      type,
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

    await Otp.deleteMany({ userId: user._id });

    const subject = "Mã xác thực lại tài khoản";
    await sendOtp.generateAndSendOtp(user._id, subject, email);

    telegramBot
      .notifyReAuthRequest({
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
      })
      .catch((err) => {
        console.error("⚠️ Không thể gửi thông báo Telegram:", err.message);
      });

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

    //  Hash password với bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await User.findByIdAndUpdate(userId, {
      fullName,
      password: hashedPassword,
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

// [POST] /api/v1/auth/login
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({
        code: 400,
        message: "Thiếu email hoặc mật khẩu",
      });
    }

    //  Populate province và ward để có đầy đủ thông tin
    const user = await User.findOne({ email, deleted: false, status: "active" })
      .populate("province")
      .populate("ward")
      .select("-deleted -deletedAt -__v -securityCode");

    if (!user) {
      return res.json({
        code: 400,
        message: "Tài khoản không tồn tại hoặc chưa kích hoạt",
      });
    }

    //  Verify password với bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.json({
        code: 400,
        message: "Sai mật khẩu",
      });
    }

    //  Tạo Access Token với FULL user info
    const accessToken = generateAccessToken(user);

    //  Tạo Refresh Token
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES);

    // Lưu Refresh Token vào DB
    await RefreshTokenUser.create({
      user_id: user._id,
      token: refreshToken,
      expiresAt: expiresAt,
    });

    //  LƯU CẢ 2 TOKEN VÀO COOKIE
    res.cookie("authToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 15 * 60 * 1000, // 15 phút
    });

    res.cookie("userRefreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: REFRESH_TOKEN_EXPIRES, // 7 ngày
    });

    //  Trả về user info (KHÔNG trả token nữa)
    return res.json({
      code: 200,
      message: "Đăng nhập thành công",
      user: {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        userName: user.userName,
        customName: user.customName,
        avatar: user.avatar,
        phone: user.phone,
        sex: user.sex,
        birthDay: user.birthDay,
        address: user.address,
        province: user.province,
        ward: user.ward,
        status: user.status,
        isAnonymous: user.isAnonymous,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/refresh-token
module.exports.refreshToken = async (req, res) => {
  try {
    //  Lấy refreshToken từ cookie
    const refreshToken = req.cookies.userRefreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    // Kiểm tra token trong DB
    const tokenRecord = await RefreshTokenUser.findOne({
      token: refreshToken,
      expiresAt: { $gt: new Date() },
    }).populate({
      path: "user_id",
      populate: [{ path: "province" }, { path: "ward" }],
      select: "-password -deleted -deletedAt -__v -securityCode",
    });

    if (!tokenRecord) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Tạo access token mới với FULL user info
    const newAccessToken = generateAccessToken(tokenRecord.user_id);

    //  Set cookie authToken mới
    res.cookie("authToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 15 * 60 * 1000,
    });

    return res.json({
      code: 200,
      message: "Token refreshed successfully",
      user: {
        userId: tokenRecord.user_id._id,
        fullName: tokenRecord.user_id.fullName,
        email: tokenRecord.user_id.email,
        userName: tokenRecord.user_id.userName,
        customName: tokenRecord.user_id.customName,
        avatar: tokenRecord.user_id.avatar,
        phone: tokenRecord.user_id.phone,
        sex: tokenRecord.user_id.sex,
        birthDay: tokenRecord.user_id.birthDay,
        address: tokenRecord.user_id.address,
        province: tokenRecord.user_id.province,
        ward: tokenRecord.user_id.ward,
        status: tokenRecord.user_id.status,
        isAnonymous: tokenRecord.user_id.isAnonymous,
        createdAt: tokenRecord.user_id.createdAt,
        updatedAt: tokenRecord.user_id.updatedAt,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// [POST] /api/v1/user/logout
module.exports.logout = async (req, res) => {
  try {
    //  Lấy refreshToken từ cookie
    const refreshToken = req.cookies.userRefreshToken;

    if (refreshToken) {
      // Xóa token khỏi DB
      await RefreshTokenUser.deleteOne({ token: refreshToken });
    }

    //  XÓA CẢ 2 COOKIE
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.clearCookie("userRefreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.json({
      code: 200,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [GET] /api/v1/user/me - Giờ chỉ cần verify token, không cần query DB
module.exports.getMe = async (req, res) => {
  try {
    // req.user đã có đầy đủ thông tin từ JWT decode
    if (!req.user) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    // Nếu cần data mới nhất từ DB (optional)
    const user = await User.findById(req.user.userId)
      .populate("province", "name code")
      .populate("ward", "name code parent_code")
      .select("-password -deleted -deletedAt -__v -securityCode");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [GET] /api/v1/user/user-profile
module.exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId)
      .select(
        "_id userName fullName customName email phone avatar address sex birthDay province ward securityCode status createdAt updatedAt"
      )
      .populate("province")
      .populate("ward")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "Có lỗi trong quá trình lấy thông tin" });
    }

    const { password, securityCode, deleted, deletedAt, ...rest } = user;

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
    const { fullName, birthDay, sex, phone, avatar, address, province, ward } =
      req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    if (fullName !== undefined) user.fullName = fullName;
    if (birthDay !== undefined) user.birthDay = new Date(birthDay);
    if (sex !== undefined) user.sex = sex;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (address !== undefined) user.address = address;

    if (province && province._id) {
      const provinceDoc = await Province.findById(province._id);
      if (!provinceDoc)
        return res.status(400).json({ message: "Tỉnh/Thành không hợp lệ" });
      user.province = provinceDoc._id;

      if (!ward || ward.parent_code !== provinceDoc.code) {
        user.ward = undefined;
      }
    }

    if (ward && ward._id && user.province) {
      const wardDoc = await Ward.findById(ward._id);
      if (!wardDoc)
        return res.status(400).json({ message: "Phường/Xã không hợp lệ" });

      const provinceDoc = await Province.findById(user.province);
      if (wardDoc.parent_code !== provinceDoc.code)
        return res.status(400).json({
          message: "Phường/Xã không thuộc tỉnh/thành đã chọn",
        });

      user.ward = wardDoc._id;
    }

    await user.save();

    const updatedUser = await User.findById(userId)
      .populate("province")
      .populate("ward")
      .select("-password");

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
