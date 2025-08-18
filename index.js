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
app.use(bodyParser.json());
app.use(cors());
database.connect();

// Routes Version 1
routesApiVer1(app);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
