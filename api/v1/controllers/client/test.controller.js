const Ward = require("../../models/ward.model");
const Province = require("../../models/province.model");
const TourCategory = require("../../models/tour-category.model");
const HomeCategory = require("../../models/home-page.model");
const ServiceCategory = require("../../models/service.model");
const NewsCategory = require("../../models/new-category.model");
const LibraryCategory = require("../../models/library.model");
const ContactCategory = require("../../models/contact.model");
const InfoCategory = require("../../models/information.model");
const Tour = require("../../models/tour.model");
const Vehicle = require("../../models/vehicle.model");
const TravelTime = require("../../models/travel-time.model");
const Frequency = require("../../models/frequency.model");
const Hotel = require("../../models/hotel.model");
const Banner = require("../../models/banner.model");
const Term = require("../../models/term.model");
const TypeOfPerson = require("../../models/type-of-person.model");
const buildTree = require("../../../../helpers/buildTree");
module.exports.province = async (req, res) => {
  try {
    const province = await Province.find();
    res.json(province);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
module.exports.ward = async (req, res) => {
  try {
    const ward = await Ward.find();
    res.json(ward);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//  lấy dữ liệu để làm dạng cây navigation cho danh mục tour
module.exports.tourCategory = async (req, res) => {
  try {
    const tourCategory = await TourCategory.find();
    const treeTourCategory = buildTree(tourCategory);
    res.json(treeTourCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  lấy dữ liệu để làm dạng cây navigation cho danh mục trang chủ
module.exports.homePage = async (req, res) => {
  try {
    const homeCategory = await HomeCategory.find();
    const treeHomeCategory = buildTree(homeCategory);
    res.json(treeHomeCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  lấy dữ liệu để làm dạng cây navigation cho danh mục dịch vụ
module.exports.serviceCategory = async (req, res) => {
  try {
    const serviceCategory = await ServiceCategory.find();
    const treeServiceCategory = buildTree(serviceCategory);
    res.json(treeServiceCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  lấy dữ liệu để làm dạng cây navigation cho danh mục tin tức
module.exports.newsCategory = async (req, res) => {
  try {
    const newsCategory = await NewsCategory.find();
    const treeNewsCategory = buildTree(newsCategory);
    res.json(treeNewsCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
//  lấy dữ liệu để làm dạng cây navigation cho danh mục thư viện
module.exports.libraryCategory = async (req, res) => {
  try {
    const libraryCategory = await LibraryCategory.find();
    const treeLibraryCategory = buildTree(libraryCategory);
    res.json(treeLibraryCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  lấy dữ liệu để làm dạng cây navigation cho danh mục liên hệ
module.exports.contactCategory = async (req, res) => {
  try {
    const contactCategory = await ContactCategory.find();
    const treeContactCategory = buildTree(contactCategory);
    res.json(treeContactCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  lấy dữ liệu để làm dạng cây navigation cho danh mục giới thiệu
module.exports.infoCategory = async (req, res) => {
  try {
    const infoCategory = await InfoCategory.find();
    const treeInfoCategory = buildTree(infoCategory);
    res.json(treeInfoCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  lấy dữ liệu cho danh sách tour đưa ra giao diện
module.exports.tourList = async (req, res, type) => {
  try {
    const tourList = await Tour.find({ type, active: true })
      .limit(8)
      .select(
        "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type"
      )
      .lean();

    for (let item of tourList) {
      item.vehicle = [];
      const travelTime = await TravelTime.findById(item.travelTimeId).lean();
      if (travelTime) {
        item.day = travelTime.day;
        item.night = travelTime.night;
      }

      const listVehicle = await Vehicle.find({ _id: item.vehicleId }).lean();
      if (listVehicle.length > 0) {
        item.vehicle = listVehicle.map((vehicle) => vehicle.name);
      }

      const frequencyObject = await Frequency.findOne({
        _id: item.frequency,
      }).lean();
      item.frequency = frequencyObject?.title || "";

      const hotelObject = await Hotel.findOne({ _id: item.hotelId })
        .select("star")
        .lean();
      item.hotelStar = hotelObject?.star || 0;
    }

    res.json(tourList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports.tourListDomestic = (req, res) =>
  module.exports.tourList(req, res, "domestic");
module.exports.tourListAboard = (req, res) =>
  module.exports.tourList(req, res, "aboard");
// Trả về banner trên và dưới của trang chủ

module.exports.banner = async (req, res) => {
  try {
    const bannerList = await Banner.find();
    res.json(bannerList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
