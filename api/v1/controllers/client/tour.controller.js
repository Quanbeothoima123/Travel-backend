const TourCategory = require("../../models/tour-category.model");
const Tour = require("../../models/tour.model");
const Vehicle = require("../../models/vehicle.model");
const TravelTime = require("../../models/travel-time.model");
const Frequency = require("../../models/frequency.model");
const Filter = require("../../models/filter.model");
const DepartPlace = require("../../models/depart-place.model");
const Hotel = require("../../models/hotel.model");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");

//  lấy dữ liệu cho danh sách tour đưa ra giao diện
module.exports.tourList = async (req, res, type) => {
  try {
    const tourList = await Tour.find({ type, active: true })
      .limit(12)
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

module.exports.getIdAndTitle = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const query = { active: "true" };
    const tours = await Tour.find(query).limit(limit).select("_id title");

    res.json({
      success: true,
      tours: tours,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

module.exports.detailTour = async (req, res) => {
  try {
    const slug = req.params.slug;

    const tourDetail = await Tour.findOne({ slug })
      .select("-createdAt -updatedAt -__v")
      .populate("categoryId", "title slug")
      .populate("travelTimeId", "day night")
      .populate("hotelId", "name thumbnail star")
      .populate("vehicleId", "name image")
      .populate("departPlaceId", "name description googleDirection")
      .populate("frequency", "title")
      .populate("term.termId", "title icon")
      .populate("additionalPrices.typeOfPersonId", "name")
      .populate("allowTypePeople", "name")
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

// [GET] /api/v1/tours/search-combined
module.exports.searchToursCombined = async (req, res) => {
  try {
    const {
      category,
      query,
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      departPlace,
      filters,
      vehicles,
    } = req.query;

    const filter = {};

    // Category filter
    if (category) {
      const rootCategory = await TourCategory.findOne({
        slug: category,
      }).lean();
      if (!rootCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục" });
      }
      const childIds = await getAllDescendantIds(
        TourCategory,
        rootCategory._id
      );
      const allCategoryIds = [
        rootCategory._id.toString(),
        ...childIds.map((id) => id.toString()),
      ];
      filter.categoryId = { $in: allCategoryIds };
    }

    // Query filter
    let queryFilter = {};
    if (query) {
      const regex = new RegExp(query.trim().split(/\s+/).join(".*"), "i");
      queryFilter.title = { $regex: regex };
    }

    // ✅ FIXED: Price filter with correct MongoDB syntax
    if (minPrice || maxPrice) {
      filter.prices = {};
      if (minPrice) {
        const minPriceNum = parseInt(minPrice, 10);
        if (!isNaN(minPriceNum)) {
          filter.prices.$gte = minPriceNum;
        }
      }
      if (maxPrice) {
        const maxPriceNum = parseInt(maxPrice, 10);
        if (!isNaN(maxPriceNum)) {
          filter.prices.$lte = maxPriceNum;
        }
      }
    }

    // Depart place filter
    if (departPlace) {
      const departPlaceObj = await DepartPlace.findOne({
        slug: departPlace,
      }).lean();
      if (departPlaceObj) {
        filter.departPlaceId = departPlaceObj._id;
      }
    }

    // Filters (tour characteristics)
    if (filters && filters.length > 0) {
      const filterArray = Array.isArray(filters) ? filters : [filters];
      const filterIds = await Filter.find({ slug: { $in: filterArray } })
        .select("_id")
        .lean();
      if (filterIds.length > 0) {
        filter.filterId = { $in: filterIds.map((f) => f._id) };
      }
    }

    // Vehicles filter
    if (vehicles && vehicles.length > 0) {
      const vehicleArray = Array.isArray(vehicles) ? vehicles : [vehicles];
      const vehicleIds = await Vehicle.find({ slug: { $in: vehicleArray } })
        .select("_id")
        .lean();
      if (vehicleIds.length > 0) {
        filter.vehicleId = { $in: vehicleIds.map((v) => v._id) };
      }
    }

    const baseFilter = { ...filter, ...queryFilter };

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Main query
    let [tours, totalItems] = await Promise.all([
      Tour.find(baseFilter)
        .select(
          "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type departPlaceId filterId"
        )
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Tour.countDocuments(baseFilter),
    ]);

    // Fallback: if query has no results but category exists, search by category only
    if (query && tours.length === 0 && category) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.title;
      [tours, totalItems] = await Promise.all([
        Tour.find(fallbackFilter)
          .select(
            "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type departPlaceId filterId"
          )
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Tour.countDocuments(fallbackFilter),
      ]);
    }

    const totalPages = Math.ceil(totalItems / limitNum);

    // Enrich tours with related data
    for (let item of tours) {
      item.vehicle = [];
      const travelTime = await TravelTime.findById(item.travelTimeId).lean();
      if (travelTime) {
        item.day = travelTime.day;
        item.night = travelTime.night;
      }
      const listVehicle = await Vehicle.find({
        _id: { $in: item.vehicleId },
      }).lean();
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
// Lấy danh sách tour theo category.slug (bao gồm category con)
module.exports.tourListByCategory = async (req, res) => {
  try {
    const slug = req.params.slug;

    // tìm category gốc theo slug
    const rootCategory = await TourCategory.findOne({ slug }).lean();
    if (!rootCategory) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tour có danh mục này" });
    }

    // lấy tất cả category con
    const childIds = await getAllDescendantIds(TourCategory, rootCategory._id);
    const allCategoryIds = [
      rootCategory._id.toString(),
      ...childIds.map((id) => id.toString()),
    ];

    // query tour + populate
    const tourList = await Tour.find({
      categoryId: { $in: allCategoryIds },
    })
      .select(
        "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type"
      )
      .populate({
        path: "travelTimeId",
        select: "day night", // chỉ lấy field cần thiết
      })
      .populate({
        path: "vehicleId",
        select: "name", // lấy tên vehicle
      })
      .populate({
        path: "frequency",
        select: "title",
      })
      .populate({
        path: "hotelId",
        select: "star",
      })
      .lean();

    // map lại cho đúng structure mong muốn
    const formattedTours = tourList.map((item) => ({
      ...item,
      day: item.travelTimeId?.day || 0,
      night: item.travelTimeId?.night || 0,
      vehicle: item.vehicleId?.map((v) => v.name) || [],
      frequency: item.frequency?.title || "",
      hotelStar: item.hotelId?.star || 0,
    }));

    res.json(formattedTours);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// [GET] /api/v1/tours/advanced-search
module.exports.advancedSearchTours = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const category = categorySlug;
    const {
      q,
      minPrice,
      maxPrice,
      departPlace,
      filters,
      vehicles,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { deleted: false };

    // Tên tour
    if (q) {
      const regex = new RegExp(q.trim().split(/\s+/).join(".*"), "i");
      filter.title = { $regex: regex };
    }

    // Category (bao gồm con)
    if (category) {
      const rootCategory = await TourCategory.findOne({
        slug: category,
      }).lean();
      if (!rootCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục" });
      }
      const childIds = await getAllDescendantIds(
        TourCategory,
        rootCategory._id
      );
      const allCategoryIds = [rootCategory._id, ...childIds];
      filter.categoryId = { $in: allCategoryIds };
    }

    // Ngân sách
    if (minPrice || maxPrice) {
      filter.prices = {};
      if (minPrice) filter.prices.$gte = parseInt(minPrice, 10);
      if (maxPrice) filter.prices.$lte = parseInt(maxPrice, 10);
    }

    // Điểm khởi hành
    if (departPlace) {
      const dp = await DepartPlace.findOne({ slug: departPlace }).lean();
      if (!dp) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy điểm khởi hành" });
      }
      filter.departPlaceId = dp._id;
    }

    // Filter slug
    if (filters) {
      const arr = Array.isArray(filters) ? filters : [filters];
      const filterDocs = await Filter.find({ slug: { $in: arr } }).lean();
      const ids = filterDocs.map((f) => f._id);
      if (ids.length > 0) {
        filter.filterId = { $in: ids };
      }
    }

    // Vehicle slug
    if (vehicles) {
      const arr = Array.isArray(vehicles) ? vehicles : [vehicles];
      const vehicleDocs = await Vehicle.find({ slug: { $in: arr } }).lean();
      const ids = vehicleDocs.map((v) => v._id);
      if (ids.length > 0) {
        // phải chứa đủ hết
        filter.vehicleId = { $in: ids };
      }
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Query
    const [tours, totalItems] = await Promise.all([
      Tour.find(filter)
        .select(
          "title thumbnail travelTimeId prices discount seats vehicleId hotelId frequency slug type"
        )
        .populate({ path: "travelTimeId", select: "day night" })
        .populate({ path: "vehicleId", select: "name" })
        .populate({ path: "frequency", select: "title" })
        .populate({ path: "hotelId", select: "star" })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Tour.countDocuments(filter),
    ]);

    // Format kết quả
    const formattedTours = tours.map((item) => ({
      ...item,
      day: item.travelTimeId?.day || 0,
      night: item.travelTimeId?.night || 0,
      vehicle: item.vehicleId?.map((v) => v.name) || [],
      frequency: item.frequency?.title || "",
      hotelStar: item.hotelId?.star || 0,
    }));

    res.json({
      data: formattedTours,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
