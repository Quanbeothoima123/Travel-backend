const axios = require("axios");

// Cấu hình Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Lưu danh sách các chat đã đăng ký nhận thông báo
let registeredChats = new Set();

/**
 * Gửi message đến TẤT CẢ các chat đã đăng ký
 */
const broadcastMessage = async (message) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN chưa được cấu hình");
    return;
  }

  if (registeredChats.size === 0) {
    console.warn("⚠️ Chưa có chat nào đăng ký nhận thông báo");
    return;
  }

  const results = [];
  for (const chatId of registeredChats) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      results.push({ chatId, success: true });
      console.log(`✅ Đã gửi thông báo đến chat ${chatId}`);
    } catch (error) {
      console.error(
        `❌ Lỗi gửi đến chat ${chatId}:`,
        error.response?.data?.description || error.message
      );
      results.push({ chatId, success: false, error: error.message });
    }
  }

  return results;
};

/**
 * Gửi message đến 1 chat cụ thể
 */
const sendMessage = async (message, chatId) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN chưa được cấu hình");
    return null;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    console.log(`✅ Đã gửi thông báo đến chat ${chatId}`);
    return response.data;
  } catch (error) {
    console.error(
      `❌ Lỗi gửi Telegram:`,
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Xử lý lệnh từ Telegram
 */
const handleCommand = async (message) => {
  const chatId = message.chat.id;
  const text = message.text?.trim() || "";
  const chatTitle = message.chat.title || message.chat.first_name || "Unknown";

  console.log(`📨 Nhận lệnh từ ${chatTitle} (${chatId}): ${text}`);

  // Lệnh /start hoặc /subscribe - đăng ký nhận thông báo
  if (
    text === "/start" ||
    text === "/subscribe" ||
    text.toLowerCase() === "đăng ký"
  ) {
    registeredChats.add(chatId);
    console.log(`✅ Chat ${chatId} đã đăng ký nhận thông báo`);

    await sendMessage(
      `
🎉 <b>ĐĂNG KÝ THÀNH CÔNG!</b>

Chat này đã được đăng ký nhận thông báo tự động từ hệ thống.

📬 Bạn sẽ nhận được thông báo về:
• 👤 User mới đăng ký
• 🛒 Đơn hàng mới
• 💰 Thanh toán thành công
• 🗺️ Tour mới
• 📰 Bài viết mới
• 📊 Báo cáo hàng ngày

<b>Các lệnh khả dụng:</b>
/status - Kiểm tra trạng thái
/unsubscribe - Huỷ đăng ký
/help - Hướng dẫn
    `.trim(),
      chatId
    );
  }

  // Lệnh /unsubscribe - huỷ đăng ký
  else if (text === "/unsubscribe" || text.toLowerCase() === "huỷ") {
    registeredChats.delete(chatId);
    console.log(`❌ Chat ${chatId} đã huỷ đăng ký`);

    await sendMessage(
      `
🔕 <b>ĐÃ HUỶ ĐĂNG KÝ</b>

Chat này sẽ không còn nhận thông báo tự động.

Để đăng ký lại, gửi lệnh: /start
    `.trim(),
      chatId
    );
  }

  // Lệnh /status - kiểm tra trạng thái
  else if (text === "/status") {
    const isRegistered = registeredChats.has(chatId);
    const totalChats = registeredChats.size;

    await sendMessage(
      `
📊 <b>TRẠNG THÁI HỆ THỐNG</b>

🔔 Trạng thái chat này: ${
        isRegistered ? "✅ Đang nhận thông báo" : "❌ Chưa đăng ký"
      }
📱 Tổng số chat đã đăng ký: ${totalChats}
⏰ Thời gian: ${new Date().toLocaleString("vi-VN")}

${!isRegistered ? "Gửi /start để đăng ký nhận thông báo" : ""}
    `.trim(),
      chatId
    );
  }

  // Lệnh /help - hướng dẫn
  else if (text === "/help") {
    await sendMessage(
      `
📖 <b>HƯỚNG DẪN SỬ DỤNG BOT</b>

<b>Lệnh cơ bản:</b>
/start - Đăng ký nhận thông báo
/unsubscribe - Huỷ đăng ký
/status - Kiểm tra trạng thái
/help - Hiển thị hướng dẫn này
/test - Gửi thông báo test

<b>Lưu ý:</b>
• Bot chỉ gửi thông báo đến các chat đã đăng ký
• Có thể dùng trong chat riêng hoặc group
• Trong group, bot cần quyền gửi tin nhắn
    `.trim(),
      chatId
    );
  }

  // Lệnh /test - gửi thông báo test
  else if (text === "/test") {
    await sendMessage(
      `
🧪 <b>THÔNG BÁO TEST</b>

Đây là thông báo test để kiểm tra bot.

✅ Nếu bạn nhận được tin nhắn này, bot đang hoạt động bình thường!
⏰ ${new Date().toLocaleString("vi-VN")}
    `.trim(),
      chatId
    );
  }

  // Tin nhắn không phải lệnh
  else if (text.startsWith("/")) {
    await sendMessage(
      `
❓ <b>LỆNH KHÔNG HỢP LỆ</b>

Lệnh "${text}" không tồn tại.
Gửi /help để xem danh sách lệnh.
    `.trim(),
      chatId
    );
  }
};

/**
 * Polling - lắng nghe tin nhắn từ Telegram liên tục
 */
let lastUpdateId = 0;
const startPolling = () => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN chưa được cấu hình");
    return;
  }

  console.log("🤖 Telegram Bot đang chạy...");
  console.log("📡 Đang lắng nghe lệnh từ Telegram...\n");

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
      const response = await axios.get(url, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 30,
        },
      });

      if (response.data.ok && response.data.result.length > 0) {
        for (const update of response.data.result) {
          lastUpdateId = update.update_id;

          if (update.message) {
            await handleCommand(update.message);
          }
        }
      }
    } catch (error) {
      console.error("❌ Lỗi polling:", error.message);
    }

    // Tiếp tục polling
    setTimeout(poll, 1000);
  };

  poll();
};

/**
 * Gửi thông báo user đăng ký thành công
 */
const notifyUserRegistration = async (userData) => {
  const { userId, email, fullName, phone, createdAt } = userData;

  const message = `
🎉 <b>USER MỚI ĐĂNG KÝ THÀNH CÔNG</b>

👤 <b>Họ tên:</b> ${fullName || "Chưa cập nhật"}
📧 <b>Email:</b> ${email}
📱 <b>SĐT:</b> ${phone || "Chưa cập nhật"}
🆔 <b>User ID:</b> ${userId}
📅 <b>Thời gian:</b> ${new Date(createdAt).toLocaleString("vi-VN")}

✅ Tài khoản đã được kích hoạt!
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Gửi thông báo user yêu cầu gửi lại OTP
 */
const notifyReAuthRequest = async (userData) => {
  const { userId, email, fullName } = userData;

  const message = `
🔄 <b>YÊU CẦU GỬI LẠI OTP</b>

👤 <b>Họ tên:</b> ${fullName || "Chưa cập nhật"}
📧 <b>Email:</b> ${email}
🆔 <b>User ID:</b> ${userId}
⏰ <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}

ℹ️ User đang yêu cầu gửi lại mã OTP
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Gửi thông báo đơn hàng mới
 */
const notifyNewOrder = async (orderData) => {
  const {
    invoiceCode,
    nameOfUser,
    phoneNumber,
    email,
    totalPrice,
    totalPeople,
    tourTitle,
    typeOfPayment,
    createdAt,
  } = orderData;

  const paymentNames = {
    cash: "💵 Tiền mặt",
    "bank-transfer": "🏦 Chuyển khoản",
    "credit-card": "💳 Thẻ tín dụng",
    momo: "📱 MoMo",
    zalopay: "💰 ZaloPay",
  };

  const message = `
🛒 <b>ĐƠN HÀNG MỚI</b>

📋 <b>Mã đơn:</b> ${invoiceCode}
🎫 <b>Tour:</b> ${tourTitle || "N/A"}

👤 <b>Khách hàng:</b> ${nameOfUser}
📧 <b>Email:</b> ${email}
📱 <b>SĐT:</b> ${phoneNumber}

👥 <b>Số người:</b> ${totalPeople}
💰 <b>Tổng tiền:</b> ${(totalPrice / 1000000).toFixed(1)} triệu VNĐ
💳 <b>Thanh toán:</b> ${paymentNames[typeOfPayment] || typeOfPayment}
📅 <b>Thời gian:</b> ${new Date(createdAt).toLocaleString("vi-VN")}

${typeOfPayment === "cash" ? "⚠️ Chưa thanh toán" : "⏳ Đang chờ thanh toán"}
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Gửi thông báo thanh toán thành công
 */
const notifyPaymentSuccess = async (paymentData) => {
  const {
    invoiceCode,
    nameOfUser,
    totalPrice,
    typeOfPayment,
    transactionId,
    datePayment,
  } = paymentData;

  const message = `
✅ <b>THANH TOÁN THÀNH CÔNG</b>

📋 <b>Mã đơn:</b> ${invoiceCode}
👤 <b>Khách hàng:</b> ${nameOfUser}
💰 <b>Số tiền:</b> ${(totalPrice / 1000000).toFixed(1)} triệu VNĐ
💳 <b>Phương thức:</b> ${typeOfPayment}
${transactionId ? `🔖 <b>Mã GD:</b> ${transactionId}` : ""}
⏰ <b>Thời gian:</b> ${new Date(datePayment).toLocaleString("vi-VN")}

💵 Đã thu về doanh thu!
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Gửi thông báo bài viết mới được publish
 */
const notifyNewArticlePublished = async (newsData) => {
  const { title, type, author, publishedAt, slug } = newsData;

  const typeNames = {
    news: "📰 Tin tức",
    guide: "📖 Hướng dẫn",
    review: "⭐ Đánh giá",
    event: "🎉 Sự kiện",
    promotion: "🎁 Khuyến mãi",
  };

  const message = `
📝 <b>BÀI VIẾT MỚI ĐƯỢC XUẤT BẢN</b>

${typeNames[type] || type}
<b>${title}</b>

✍️ <b>Tác giả:</b> ${author.type === "admin" ? "Admin" : "User"}
📅 <b>Thời gian:</b> ${new Date(publishedAt).toLocaleString("vi-VN")}
🔗 <b>Slug:</b> ${slug}

🌐 Bài viết đã được công khai!
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Gửi thông báo tour mới được tạo
 */
const notifyNewTour = async (tourData) => {
  const { title, prices, discount, seats, type, tags } = tourData;

  const finalPrice = discount > 0 ? prices * (1 - discount / 100) : prices;

  const message = `
🗺️ <b>TOUR MỚI ĐƯỢC TẠO</b>

<b>${title}</b>

💰 <b>Giá:</b> ${(prices / 1000000).toFixed(1)} triệu VNĐ
${
  discount > 0
    ? `🎁 <b>Giảm giá:</b> ${discount}% → ${(finalPrice / 1000000).toFixed(
        1
      )} triệu`
    : ""
}
👥 <b>Số chỗ:</b> ${seats}
🌍 <b>Loại:</b> ${type === "domestic" ? "Trong nước" : "Nước ngoài"}
${tags && tags.length > 0 ? `🏷️ <b>Tags:</b> ${tags.join(", ")}` : ""}

🆕 Tour mới đã sẵn sàng!
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Gửi báo cáo tổng quan hàng ngày
 */
const sendDailyReport = async (reportData) => {
  const { date, totalRevenue, totalOrders, newUsers, totalPeople } = reportData;

  const message = `
📊 <b>BÁO CÁO NGÀY ${new Date(date).toLocaleDateString("vi-VN")}</b>

💰 <b>Doanh thu:</b> ${(totalRevenue / 1000000).toFixed(1)} triệu VNĐ
🛒 <b>Đơn hàng:</b> ${totalOrders}
👥 <b>Khách du lịch:</b> ${totalPeople} người
👤 <b>User mới:</b> ${newUsers}

📈 Tổng kết hoạt động trong ngày!
  `.trim();

  return await broadcastMessage(message);
};

/**
 * Lấy danh sách chat đã đăng ký
 */
const getRegisteredChats = () => {
  return Array.from(registeredChats);
};

module.exports = {
  sendMessage,
  broadcastMessage,
  startPolling,
  handleCommand,
  notifyUserRegistration,
  notifyReAuthRequest,
  notifyNewOrder,
  notifyPaymentSuccess,
  notifyNewArticlePublished,
  notifyNewTour,
  sendDailyReport,
  getRegisteredChats,
};
