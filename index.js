// server.js hoặc index.js (file chính của bạn)
const express = require("express");
const http = require("http"); // 🔹 Thêm dòng này
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const database = require("./config/database");
const cors = require("cors");

require("dotenv").config();

const routeAdmin = require("./api/v1/routes/admin/index.route");
const routesApiVer1 = require("./api/v1/routes/client/index.route");

// 🔹 Import Socket.IO setup
const initializeSocket = require("./socket/socket");

const app = express();
const port = process.env.PORT || 5000;

// 🔹 Tạo HTTP server
const server = http.createServer(app);

// 🔹 Initialize Socket.IO
const io = initializeSocket(server);

// Make io accessible to routes (nếu cần)
app.set("io", io);

app.use(cookieParser(""));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

database.connect();

// Routes Version 1
routesApiVer1(app);
// Route Admin
routeAdmin(app);

// 🔹 Thay app.listen bằng server.listen
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Socket.IO is ready`);
});

module.exports = { app, server, io };
