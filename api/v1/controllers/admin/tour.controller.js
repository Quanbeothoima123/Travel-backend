const Tour = require("../../models/tour.model");
const mongoose = require("mongoose");
const TourCategory = require("../../models/tour-category.model");
const TravelTime = require("../../models/travel-time.model");
const Hotel = require("../../models/hotel.model");
const Vehicle = require("../../models/vehicle.model");
const Frequency = require("../../models/frequency.model");
const TypeOfPerson = require("../../models/type-of-person.model");
const Term = require("../../models/term.model");
const Filter = require("../../models/filter.model");
const DepartPlace = require("../../models/depart-place.model");
const { generateTagsAI } = require("../../../../services/tagService");
const { generateSlug } = require("../../../../services/slugService");
const getAllDescendantIds = require("../../../../helpers/getAllDescendantIds");
const jwt = require("jsonwebtoken");
module.exports.getTours = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sort,
      categoryId,
      active,
    } = req.query;
    const query = { deleted: "false" };

    // Search theo title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Filter theo category (bao gồm cả con)
    if (categoryId) {
      const ids = await getAllDescendantIds(TourCategory, categoryId);
      query.categoryId = { $in: [categoryId, ...ids] };
    }

    // Filter theo trạng thái
    if (active === "true") query.active = true;
    if (active === "false") query.active = false;

    // Sort
    let sortObj = { createdAt: -1 };
    if (sort) {
      switch (sort) {
        case "price_desc":
          sortObj = { prices: -1 };
          break;
        case "price_asc":
          sortObj = { prices: 1 };
          break;
        case "position_desc":
          sortObj = { position: -1 };
          break;
        case "position_asc":
          sortObj = { position: 1 };
          break;
        case "discount_desc":
          sortObj = { discount: -1 };
          break;
        case "discount_asc":
          sortObj = { discount: 1 };
          break;
        case "title_asc":
          sortObj = { title: 1 };
          break;
        case "title_desc":
          sortObj = { title: -1 };
          break;
      }
    }

    // Pagination
    const total = await Tour.countDocuments(query);
    const tours = await Tour.find(query)
      .populate("categoryId", "title slug")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort(sortObj);

    res.json({
      success: true,
      data: tours,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// api/v1/admin/tours/get-all-tour-advanced
module.exports.getToursAdvanced = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sort,
      categoryId,
      active,
      type,
      vehicleId,
      filterId,
      frequencyId,
    } = req.query;

    const query = { deleted: "false" };

    // Search theo title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Filter theo category (bao gồm cả con)
    if (categoryId) {
      const descendantIds = await getAllDescendantIds(
        TourCategory,
        categoryId,
        "parentId"
      );
      query.categoryId = { $in: [categoryId, ...descendantIds] };
    }

    // Filter theo trạng thái active
    if (active === "true") query.active = true;
    if (active === "false") query.active = false;

    // Filter theo type
    if (type && ["domestic", "aboard"].includes(type)) {
      query.type = type;
    }

    // Filter theo vehicle
    if (vehicleId) {
      query.vehicleId = vehicleId;
    }

    // Filter theo filter
    if (filterId) {
      query.filterId = { $in: [filterId] };
    }

    // Filter theo frequency
    if (frequencyId) {
      query.frequency = frequencyId;
    }

    // Sort
    let sortObj = { createdAt: -1 };
    if (sort) {
      switch (sort) {
        case "price_desc":
          sortObj = { prices: -1 };
          break;
        case "price_asc":
          sortObj = { prices: 1 };
          break;
        case "position_desc":
          sortObj = { position: -1 };
          break;
        case "position_asc":
          sortObj = { position: 1 };
          break;
        case "discount_desc":
          sortObj = { discount: -1 };
          break;
        case "discount_asc":
          sortObj = { discount: 1 };
          break;
        case "title_asc":
          sortObj = { title: 1 };
          break;
        case "title_desc":
          sortObj = { title: -1 };
          break;
        default:
          sortObj = { createdAt: -1 };
      }
    }

    // Pagination
    const total = await Tour.countDocuments(query);
    const tours = await Tour.find(query)
      .populate("categoryId", "title slug")
      .populate("vehicleId", "name image slug")
      .populate("filterId", "label value slug")
      .populate("frequency", "title")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort(sortObj);

    res.json({
      success: true,
      data: tours,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
module.exports.getIdAndTitle = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const query = { active: "true" };
    const tours = await Tour.find(query)
      .limit(limit)
      .select("_id title thumbnail slug");

    res.json({
      success: true,
      tours: tours,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk Update
module.exports.bulkUpdateTours = async (req, res) => {
  try {
    const { ids, set, positions } = req.body;

    if (!ids || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Thiếu danh sách ids",
      });
    }

    // Nếu có positions → update từng tour
    if (Array.isArray(positions) && positions.length > 0) {
      for (const p of positions) {
        const payload = { ...(set || {}) };
        if (p.position !== undefined) {
          payload.position = Number(p.position) || 0;
        }
        await Tour.findByIdAndUpdate(p.id, payload);
      }
      return res.json({
        success: true,
        message: `Đã cập nhật ${positions.length} sản phẩm(Có cập nhật vị trí).`,
      });
    }

    // Nếu chỉ có set → update nhiều tour
    if (set && Object.keys(set).length > 0) {
      await Tour.updateMany({ _id: { $in: ids } }, { $set: set });
      return res.json({
        success: true,
        message: `Đã cập nhật ${ids.length} sản phẩm.`,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Không có dữ liệu để cập nhật",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Update 1 Tour
module.exports.updateTour = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Tour.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour này!",
      });
    }
    res.json({
      success: true,
      message: "Cập nhật tour thành công",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * POST /api/v1/tours/create
 */
module.exports.createTour = async (req, res) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies.adminToken;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Không có token, vui lòng đăng nhập" });
    }

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Token không hợp lệ" });
    }

    // Dữ liệu body từ frontend
    const body = req.body;

    // Gán thêm createdBy
    const tourData = {
      ...body,
      createdBy: {
        _id: decoded.id,
        at: new Date(),
      },
    };

    // Tạo tour mới
    const newTour = new Tour(tourData);
    await newTour.save();

    return res.status(201).json({
      success: true,
      message: "Tạo tour thành công",
      tour: newTour,
    });
  } catch (err) {
    console.error("Lỗi khi tạo tour:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/v1/tours/check-info-tour-create
 */
module.exports.checkTour = async (req, res) => {
  try {
    const data = req.body;

    // === 1. Check các trường bắt buộc (trừ term, vì check riêng) ===
    const requiredFields = [
      { field: "title", label: "Tên tour" },
      { field: "slug", label: "Slug" },
      { field: "categoryId", label: "Danh mục" },
      { field: "travelTimeId", label: "Thời gian tour" },
      { field: "hotelId", label: "Khách sạn" },
      { field: "vehicleId", label: "Phương tiện" },
      { field: "frequency", label: "Tần suất" },
      { field: "prices", label: "Giá tour" },
      { field: "discount", label: "Giảm giá" },
      { field: "seats", label: "Số ghế" },
      { field: "type", label: "Loại tour" },
      { field: "filterId", label: "Bộ lọc" },
      { field: "active", label: "Trạng thái" },
      { field: "position", label: "Vị trí" },
      { field: "thumbnail", label: "Ảnh bìa" },
      { field: "images", label: "Thư viện ảnh" },
      { field: "departPlaceId", label: "Nơi khởi hành" },
      { field: "tags", label: "Tags" },
      { field: "description", label: "Mô tả lịch trình" },
      { field: "specialExperience", label: "Trải nghiệm đặc biệt" },
    ];

    for (let { field, label } of requiredFields) {
      if (label === "Bộ lọc") {
        console.log(data[field]);
      }
      if (
        data[field] === undefined ||
        data[field] === null ||
        (typeof data[field] === "string" && data[field].trim() === "") ||
        (Array.isArray(data[field]) && data[field].length === 0)
      ) {
        return res.status(400).json({
          success: false,
          message: `Trường "${label}" không được để trống`,
        });
      }
    }

    // === 1.1 Validate số học ===
    if (data.discount < 0 || data.discount > 100) {
      return res.status(400).json({
        success: false,
        message: `Trường "Giảm giá" phải nằm trong khoảng 0 - 100`,
      });
    }
    if (data.prices < 0) {
      return res.status(400).json({
        success: false,
        message: `Trường "Giá tour" phải >= 0`,
      });
    }
    if (data.seats <= 0) {
      return res.status(400).json({
        success: false,
        message: `Trường "Số ghế" phải >= 1`,
      });
    }

    // === 1.2 Check enum ===
    const allowedTypes = ["domestic", "aboard"];
    if (!allowedTypes.includes(data.type)) {
      return res.status(400).json({
        success: false,
        message: `Trường "Loại tour" chỉ chấp nhận: ${allowedTypes.join(", ")}`,
      });
    }

    // === 1.3 Check slug duy nhất ===
    const existingTour = await Tour.findOne({ slug: data.slug });
    if (existingTour) {
      return res.status(400).json({
        success: false,
        message: `Slug "${data.slug}" đã tồn tại, vui lòng chọn slug khác`,
      });
    }

    // === 2. Check ID tồn tại ===
    const checkExists = async (Model, id, name) => {
      const realId = id && id._id ? id._id : id;
      if (!mongoose.Types.ObjectId.isValid(realId)) {
        throw new Error(`"${name}" không hợp lệ`);
      }
      const exists = await Model.findById(realId);
      if (!exists) throw new Error(`"${name}" không tồn tại`);
    };

    await checkExists(TourCategory, data.categoryId, "Danh mục");
    await checkExists(TravelTime, data.travelTimeId, "Thời gian tour");
    await checkExists(Hotel, data.hotelId, "Khách sạn");
    await checkExists(Frequency, data.frequency, "Tần suất");

    for (let vId of data.vehicleId) {
      await checkExists(Vehicle, vId, "Phương tiện");
    }

    for (let fId of data.filterId) {
      await checkExists(Filter, fId, "Bộ lọc");
    }

    await checkExists(DepartPlace, data.departPlaceId, "Nơi khởi hành");

    // === 3. Check term ===
    if (!Array.isArray(data.term) || data.term.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Trường "Điều khoản" không được để trống`,
      });
    }

    for (let t of data.term) {
      if (!t.termId || !t.description || String(t.description).trim() === "") {
        return res.status(400).json({
          success: false,
          message: `Mỗi điều khoản phải có đủ "termId" và "description"`,
        });
      }
      await checkExists(Term, t.termId, "Điều khoản");
    }

    // === 4. Check allowTypePeople ===
    if (Array.isArray(data.allowTypePeople)) {
      for (let pId of data.allowTypePeople) {
        await checkExists(
          TypeOfPerson,
          pId,
          "Loại khách trong allowTypePeople"
        );
      }
    }

    // === 5. Check additionalPrices ===
    if (
      Array.isArray(data.additionalPrices) &&
      data.additionalPrices.length > 0
    ) {
      if (
        !Array.isArray(data.allowTypePeople) ||
        data.allowTypePeople.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Bạn cần chọn "Loại khách được phép" trước khi thêm phụ thu`,
        });
      }

      for (let ap of data.additionalPrices) {
        await checkExists(
          TypeOfPerson,
          ap.typeOfPersonId,
          "Loại khách (phụ thu)"
        );

        const realTypeId = ap.typeOfPersonId._id || ap.typeOfPersonId;
        if (!data.allowTypePeople.includes(realTypeId)) {
          return res.status(400).json({
            success: false,
            message: `Loại khách ${realTypeId} trong phụ thu không nằm trong danh sách được phép`,
          });
        }

        if (typeof ap.moneyMore !== "number" || ap.moneyMore <= 0) {
          return res.status(400).json({
            success: false,
            message: `Giá trị phụ thu cho loại khách ${realTypeId} phải là số dương`,
          });
        }
      }
    }

    // === 6. Check description ===
    for (let d of data.description) {
      if (!d.day || !d.title || !d.image || !d.description) {
        return res.status(400).json({
          success: false,
          message: `Mỗi ngày trong "Mô tả lịch trình" phải có đủ Ngày, Tiêu đề, Ảnh và Nội dung`,
        });
      }
    }

    // === OK ===
    return res.json({ success: true, message: "Dữ liệu tour hợp lệ" });
  } catch (err) {
    console.error("Check tour error:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/tours/countTours
 */
module.exports.countTours = async (req, res) => {
  try {
    const count = await Tour.countDocuments();
    res.json({ success: true, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
/**
 * POST /api/v1/tours/generate-tags-ai
 */
module.exports.generateTagUsingAI = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title)
      return res
        .status(400)
        .json({ success: false, message: "Bạn chưa nhập tên tour" });

    const tags = await generateTagsAI(title);
    res.json({ success: true, tags });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ success: false, message: "AI error" });
  }
};

/**
 * POST /api/v1/tours/generate-slugs-ai
 */
module.exports.generateSlugUsingAI = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title)
      return res
        .status(400)
        .json({ success: false, message: "Bạn chưa nhập tên tour" });

    const slug = await generateSlug(title);
    res.json({ success: true, slug });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ success: false, message: "AI error" });
  }
};
/**
 * GET /api/v1/admin/tours/getTourById
 */

module.exports.getTourById = async (req, res) => {
  try {
    const tourId = req.params.tourId;

    const tour = await Tour.findById(tourId)
      .populate("categoryId", "title")
      .populate("travelTimeId", "day night")
      .populate(
        "hotelId",
        "name thumbnail images description price discount star"
      )
      .populate("vehicleId", "name image")
      .populate("filterId", "label value")
      .populate("frequency", "title")
      .populate("term.termId", "title icon")
      .populate("allowTypePeople", "name")
      .populate("departPlaceId", "name googleDirection description")
      .populate("createdBy._id", "fullName")
      .populate("deletedBy._id", "fullName")
      .populate("updatedBy._id", "fullName")
      .lean();

    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thông tin của tour" });
    }

    res.status(200).json(tour);
  } catch (error) {
    console.error("Lỗi không tải được tour:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * GET /api/v1/admin/tours/delete/:tourId
 */
module.exports.delete = async (req, res) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies.adminToken;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Không có token, vui lòng đăng nhập" });
    }

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Token không hợp lệ" });
    }

    const tourId = req.params.tourId;

    // Tìm tour
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({ message: "Tour không tồn tại" });
    }

    // Nếu tour đã bị xóa trước đó
    if (tour.deleted) {
      return res.status(400).json({ message: "Tour đã bị xóa trước đó" });
    }

    // Cập nhật thông tin xóa
    tour.deleted = true;
    tour.deletedBy = {
      _id: decoded.id,
      at: new Date(),
    };

    await tour.save();

    return res.status(200).json({
      success: true,
      message: "Xóa tour thành công",
      tour,
    });
  } catch (error) {
    console.error("Lỗi khi xóa tour:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/v1/admin/tours/update/:tourId
 */

module.exports.editTour = async (req, res) => {
  try {
    // === 1. Lấy token từ cookie ===
    const token = req.cookies.adminToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Không có token, vui lòng đăng nhập",
      });
    }

    // === 2. Giải mã token ===
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(403)
        .json({ success: false, message: "Token không hợp lệ" });
    }

    const { tourId } = req.params;

    // === 3. Tìm tour ===
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tour" });
    }

    // === 4. Cập nhật từng trường nếu có trong body ===
    const fields = [
      "categoryId",
      "title",
      "thumbnail",
      "images",
      "travelTimeId",
      "hotelId",
      "departPlaceId",
      "position",
      "prices",
      "discount",
      "tags",
      "seats",
      "description",
      "term",
      "vehicleId",
      "slug",
      "type",
      "active",
      "filterId",
      "frequency",
      "specialExperience",
      "additionalPrices",
      "allowTypePeople",
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        tour[field] = req.body[field];
      }
    });

    // === 5. Thêm lịch sử updatedBy ===
    tour.updatedBy.push({
      _id: new mongoose.Types.ObjectId(decoded.id),
      at: new Date(),
    });

    // === 6. Lưu lại ===
    await tour.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật tour thành công",
      tour,
    });
  } catch (err) {
    console.error("Lỗi khi cập nhật tour:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
