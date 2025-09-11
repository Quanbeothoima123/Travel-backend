// services/emailService.js
const nodemailer = require("nodemailer");
require("dotenv").config();

class EmailService {
  constructor() {
    // Tạo transporter với cấu hình Gmail (hoặc SMTP khác)
    this.transporter = nodemailer.createTransport({
      service: "gmail", // Hoặc dùng host, port, secure cho SMTP khác
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Hàm gửi email chung
   * @param {string} to - Email người nhận
   * @param {string} subject - Tiêu đề email
   * @param {string} htmlContent - Nội dung HTML của email
   * @param {Array} attachments - File đính kèm (optional)
   * @returns {Object} - Kết quả gửi email
   */
  async sendEmail(to, subject, htmlContent, attachments = []) {
    try {
      const mailOptions = {
        from: {
          name: process.env.EMAIL_SENDER_NAME || "Tour Management System",
          address: process.env.EMAIL_USER,
        },
        to: to,
        subject: subject,
        html: htmlContent,
        attachments: attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      console.log("✅ Email sent successfully:", result.messageId);

      return {
        success: true,
        messageId: result.messageId,
        message: "Email đã được gửi thành công",
      };
    } catch (error) {
      console.error("❌ Error sending email:", error);

      return {
        success: false,
        error: error.message,
        message: "Không thể gửi email",
      };
    }
  }

  /**
   * Kiểm tra kết nối email server
   * @returns {boolean} - Trạng thái kết nối
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log("✅ Email server connection verified");
      return true;
    } catch (error) {
      console.error("❌ Email server connection failed:", error);
      return false;
    }
  }
}

module.exports = new EmailService();
