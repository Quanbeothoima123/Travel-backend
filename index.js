const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const database = require("./config/database");

// Thư viện dùng để các trình duyệt không chặn port
const cors = require("cors");

require("dotenv").config();

const routesApiVer1 = require("./api/v1/routes/index.route");

const app = express();
const port = process.env.PORT || 5000;

app.use(cookieParser(""));
// parse body json
app.use(bodyParser.json());
// parse form-urlencoded (MoMo IPN gửi dạng này)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:3000", // FE URL
    credentials: true, // cho phép gửi cookie
  })
);

database.connect();

// Routes Version 1
routesApiVer1(app);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
