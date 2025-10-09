const tourCategoryRoute = require("../admin/tour-category.route");
const travelTimeRoute = require("../admin/travel-time.route");
const hotelRoute = require("../admin/hotel.route");
const termRoute = require("../admin/term.route");
const vehicleRoute = require("../admin/vehicle.route");
const frequencyRoute = require("../admin/frequency.route");
const tourRoute = require("./tour.route");
const typeOfPersonRoute = require("./type-of-person.route");
const filterRoute = require("./filter.route");
const departPlace = require("./depart-place.route");
const invoiceRoute = require("./invoice.route");
const newsCategoryRoute = require("./news-category.route");
const galleryCategoryRoute = require("./gallery-category.route");
const galleryRoute = require("./gallery.route");
const newsRoute = require("./news.route");
const siteConfigRoute = require("./site-config.route");
const aiRoute = require("./ai.route");
const adminRoute = require("./admin.route");

const { checkAuth } = require("../../../../middlewares/admin/authAdmin");

module.exports = (app) => {
  const version = "/api/v1/admin";

  // Các route không cần checkAuth
  app.use(version, adminRoute);
  app.use(version + "/ai", aiRoute);

  // Các route cần checkAuth
  app.use(version + "/tour-categories", checkAuth, tourCategoryRoute);
  app.use(version + "/travel-time", checkAuth, travelTimeRoute);
  app.use(version + "/hotel", checkAuth, hotelRoute);
  app.use(version + "/term", checkAuth, termRoute);
  app.use(version + "/vehicle", checkAuth, vehicleRoute);
  app.use(version + "/frequency", checkAuth, frequencyRoute);
  app.use(version + "/tours", checkAuth, tourRoute);
  app.use(version + "/type-of-person", checkAuth, typeOfPersonRoute);
  app.use(version + "/filter", checkAuth, filterRoute);
  app.use(version + "/depart-place", checkAuth, departPlace);
  app.use(version + "/invoice", checkAuth, invoiceRoute);
  app.use(version + "/news-category", checkAuth, newsCategoryRoute);
  app.use(version + "/news", checkAuth, newsRoute);
  app.use(version + "/gallery-category", checkAuth, galleryCategoryRoute);
  app.use(version + "/site-config", checkAuth, siteConfigRoute);
};
