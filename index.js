const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const database = require("./config/database");
const cors = require("cors");
require("dotenv").config();

const routeAdmin = require("./api/v1/routes/admin/index.route");
const routesApiVer1 = require("./api/v1/routes/client/index.route");

const DOMAIN_WEBSITE = process.env.DOMAIN_WEBSITE || "http://localhost:3000";
const DOMAIN_WEBSITE_ADMIN =
  process.env.DOMAIN_WEBSITE_ADMIN || "http://localhost:3001";

const initializeSocket = require("./socket");
const telegramBot = require("./helpers/telegramBot");
const {
  connectRabbitMQ,
  consumeQueue,
  sendToQueue,
} = require("./config/rabbitmq");

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);

// ✅ KHỞI TẠO SOCKET.IO (đã có JWT middleware bên trong)
const io = initializeSocket(server);

app.set("io", io);
app.use(cookieParser(""));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: [DOMAIN_WEBSITE, DOMAIN_WEBSITE_ADMIN],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

database.connect();

// ✅ KẾT NỐI RABBITMQ VÀ CONSUME QUEUES
connectRabbitMQ().then(() => {
  console.log("✅ RabbitMQ connected, setting up consumers...");

  // ✅ CONSUMER: notifications.user
  consumeQueue("notifications.user", (message) => {
    console.log(" User notification received:", message.title);

    // ✅ Emit tới admin-room qua Socket.IO
    io.to("admin-room").emit("user-notification", message);
    console.log(" Emitted user-notification to admin-room");
  });

  // ✅ CONSUMER: notifications.admin
  consumeQueue("notifications.admin", (message) => {
    console.log(" Admin notification received:", message.title);

    // ✅ Emit tới admin-room qua Socket.IO
    io.to("admin-room").emit("admin-notification", message);
    console.log(" Emitted admin-notification to admin-room");
  });
});

// Routes
routesApiVer1(app);
routeAdmin(app);

// Khởi động server
server.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`✅ Socket.IO is ready`);
  console.log(`✅ Admin dashboard: ${DOMAIN_WEBSITE_ADMIN}`);
  console.log(`✅ User website: ${DOMAIN_WEBSITE}`);

  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot.startPolling();
    console.log(`✅ Telegram Bot is listening for commands...`);
  } else {
    console.warn(` TELEGRAM_BOT_TOKEN không được cấu hình`);
  }
});

process.on("SIGINT", async () => {
  console.log(" Shutting down gracefully...");
  const { closeRabbitMQ } = require("./config/rabbitmq");
  await closeRabbitMQ();
  process.exit(0);
});

// ✅ TEST RABBITMQ SAU 5 GIÂY
setTimeout(async () => {
  console.log("\n Testing RabbitMQ...");
  const { sendToQueue } = require("./config/rabbitmq");

  const testMessage = {
    id: "test-123",
    type: "admin-action",
    title: "Test notification",
    message: "This is a test",
    unread: true,
    timestamp: new Date().toISOString(),
    time: "Vừa xong",
  };

  await sendToQueue("notifications.admin", testMessage);
  console.log(" Test message sent!\n");
}, 5000);

module.exports = { app, server, io };
