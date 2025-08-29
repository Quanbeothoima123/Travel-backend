const testRoute = require("./test.route");
const userRoute = require("./user.route");
const customerConsolationRoute = require("./customer-consolation.route");
const wardRoute = require("./ward.route");
const typeOfPersonRoute = require("./type-of-person.route");
const invoiceRoute = require("./invoice.route");
const tourRoutes = require("./tour.route");
module.exports = (app) => {
  const version = "/api/v1";
  app.use(version, testRoute);
  app.use(version + "/user", userRoute);
  app.use(version, customerConsolationRoute);
  app.use(version + "/wards", wardRoute);
  app.use(version + "/type-of-person", typeOfPersonRoute);
  app.use(version, invoiceRoute);
  app.use(version + "/tours", tourRoutes);
};
