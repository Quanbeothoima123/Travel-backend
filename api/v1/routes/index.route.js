const testRoute = require("./test.route");
const userRoute = require("./user.route");
module.exports = (app) => {
  const version = "/api/v1";
  app.use(version, testRoute);
  app.use(version + "/user", userRoute);
};
