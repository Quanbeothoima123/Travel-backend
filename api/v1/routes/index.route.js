const testRoute = require("./test.route");
module.exports = (app) => {
  const version = "/api/v1";
  app.use(version, testRoute);
};
