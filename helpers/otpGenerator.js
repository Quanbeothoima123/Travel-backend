const otpGenerator = require("otp-generator");
const Otp = require("../api/v1/models/otp.model");
const nodemailer = require("nodemailer");

module.exports.generateAndSendOtp = async (userId, subject, email = "") => {
  // Kiểm tra nếu đã có OTP chưa hết hạn
  const existingOtp = await Otp.findOne({
    userId: userId,
    expireAt: { $gt: new Date() }, // OTP chưa hết hạn
  });

  if (existingOtp) {
    throw new Error("Vui lòng chờ một lát trước khi yêu cầu lại mã OTP.");
  }

  // Tạo mã OTP
  const otpCode = otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });

  const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

  // Lưu OTP mới
  await Otp.create({
    userId: userId,
    email: email,
    code: otpCode,
    expireAt,
  });

  // Gửi email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const html = `<p>Mã OTP của bạn là: <b>${otpCode}</b></p><p>Mã có hiệu lực trong 5 phút.</p>`;

  const mailOptions = {
    from: "phimanhnamquan@gmail.com",
    to: email,
    subject: subject,
    html: html,
  };

  await transporter.sendMail(mailOptions);
};
