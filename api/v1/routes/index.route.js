const testRoute = require("./test.route");
const userRoute = require("./user.route");
const customerConsolationRoute = require("./customer-consolation.route");
const wardRoute = require("../routes/ward.route");
const typeOfPersonRoute = require("../routes/type-of-person.route");
const invoiceRoute = require("../routes/invoice.route");
module.exports = (app) => {
  const version = "/api/v1";
  app.use(version, testRoute);
  app.use(version + "/user", userRoute);
  app.use(version, customerConsolationRoute);
  app.use(version + "/wards", wardRoute);
  app.use(version, typeOfPersonRoute);
  app.use(version, invoiceRoute);
};
