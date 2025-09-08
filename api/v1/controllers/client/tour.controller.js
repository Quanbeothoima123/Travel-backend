const TourCategory = require("../../models/tour-category.model");
const Tour = require("../../models/tour.model");
const Vehicle = require("../../models/vehicle.model");
const TravelTime = require("../../models/travel-time.model");
const Frequency = require("../../models/frequency.model");
const Hotel = require("../../models/hotel.model");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");
module.exports.getAllTour = async (req, res) => {
  try {
    const tours = await Tour.find({}, "title thumbnail slug");

    res.status(200).json({
      success: true,
      data: tours,
    });
  } catch (error) {
    console.error("Lỗi trong quá trình load thông tin:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// [GET] /api/v1/tours/search
module.exports.searchTour = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }
    const regex = new RegExp(query.trim().split(/\s+/).join(".*"), "i");
    const tours = await Tour.find(
      { title: { $regex: regex } },
      "title slug thumbnail"
    ).limit(10);

    res.json({ data: tours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// [GET] /api/v1/tours/search-combined
module.exports.searchToursCombined = async (req, res) => {
  try {
    const { category, query, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (category) {
      const rootCategory = await TourCategory.findOne({
        slug: category,
      }).lean();
      if (!rootCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục" });
      }

      const childIds = await getAllDescendantIds(rootCategory._id);
      const allCategoryIds = [
        rootCategory._id.toString(),
        ...childIds.map((id) => id.toString()),
      ];
      filter.categoryId = { $in: allCategoryIds };
    }

    // ✅ Thêm query filter nếu có
    let queryFilter = {};
    if (query) {
      const regex = new RegExp(query.trim().split(/\s+/).join(".*"), "i");
      queryFilter.title = { $regex: regex };
    }

    const baseFilter = { ...filter, ...queryFilter };

    // pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // query chính
    let [tours, totalItems] = await Promise.all([
      Tour.find(baseFilter)
        .select(
          "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type"
        )
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Tour.countDocuments(baseFilter),
    ]);

    // ✅ fallback: nếu có query nhưng kết quả = 0 → lấy lại theo category
    if (query && tours.length === 0 && category) {
      const fallbackFilter = { ...filter }; // chỉ category, bỏ query
      [tours, totalItems] = await Promise.all([
        Tour.find(fallbackFilter)
          .select(
            "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type"
          )
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Tour.countDocuments(fallbackFilter),
      ]);
    }

    const totalPages = Math.ceil(totalItems / limitNum);

    // enrich tours
    for (let item of tours) {
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

      const frequencyObject = await Frequency.findById(item.frequency).lean();
      item.frequency = frequencyObject?.title || "";

      const hotelObject = await Hotel.findById(item.hotelId)
        .select("star")
        .lean();
      item.hotelStar = hotelObject?.star || 0;
    }

    res.json({
      data: tours,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalItems,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports.detailTour = async (req, res) => {
  try {
    const slug = req.params.slug;

    const tourDetail = await Tour.findOne({ slug })
      .select("-createdAt -updatedAt -__v")
      .populate("categoryId", "title slug")
      .populate("travelTimeId", "day night")
      .populate("hotelId", "name thumbnail star")
      .populate("vehicleId", "name image")
      .populate("frequency", "title")
      .populate("term.termId", "title icon")
      .populate("additionalPrices.typeOfPersonId", "name")
      .populate("allowTypePeople", "name") // 👈 thêm populate cho loại người tham gia
      .lean();

    if (!tourDetail) {
      return res.status(404).json({ message: "Tour not found" });
    }

    res.json({ tourDetail });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
