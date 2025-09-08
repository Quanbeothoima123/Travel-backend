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
    const query = {};

    // Search theo title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Filter theo category (bao gồm cả con)
    if (categoryId) {
      const ids = await getAllDescendantIds(categoryId);
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

module.exports.bulkUpdateTours = async (req, res) => {
  try {
    const { ids, updateData } = req.body; // ids: [tourId1, tourId2,...]

    if (!ids || !updateData) {
      return res.status(400).json({ message: "Missing ids or updateData" });
    }

    await Tour.updateMany({ _id: { $in: ids } }, { $set: updateData });

    res.json({ message: `Đã cập nhật ${ids.length} sản phẩm` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.updateTour = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Tour.findByIdAndUpdate(id, req.body, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy tour này!" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
      decoded = jwt.verify(token, process.env.JWT_SECRET); // nhớ để secret trong .env
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

    // === 1. Check các trường bắt buộc ===
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
      { field: "departPlaces", label: "Nơi khởi hành" },
      { field: "tags", label: "Tags" },
      { field: "term", label: "Điều khoản" },
      { field: "description", label: "Mô tả lịch trình" },
      { field: "specialExperience", label: "Trải nghiệm đặc biệt" },
    ];

    for (let { field, label } of requiredFields) {
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

    // === 1.1 Validate giá trị số ===
    if (data.discount < 0 || data.discount > 100) {
      return res.status(400).json({
        success: false,
        message: `Trường "Giảm giá" phải nằm trong khoảng từ 0% đến 100%`,
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

    // === 1.2 Check enum cho type ===
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

    // === 2. Check các ID có tồn tại ===
    const checkExists = async (Model, id, name) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`"${name}" không hợp lệ`);
      }
      const exists = await Model.findById(id);
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

    for (let t of data.term) {
      await checkExists(Term, t.termId, "Điều khoản");
    }

    // === 3. Check allowTypePeople ===
    if (Array.isArray(data.allowTypePeople)) {
      for (let pId of data.allowTypePeople) {
        await checkExists(
          TypeOfPerson,
          pId,
          "Loại khách trong allowTypePeople"
        );
      }
    }

    // === 4. Check additionalPrices ===
    if (
      Array.isArray(data.additionalPrices) &&
      data.additionalPrices.length > 0
    ) {
      // Bắt buộc phải có allowTypePeople nếu có additionalPrices
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
        // Check id tồn tại
        await checkExists(
          TypeOfPerson,
          ap.typeOfPersonId,
          "Loại khách (phụ thu)"
        );

        // Check phải nằm trong allowTypePeople
        if (!data.allowTypePeople.includes(ap.typeOfPersonId)) {
          return res.status(400).json({
            success: false,
            message: `Loại khách ${ap.typeOfPersonId} trong phụ thu không nằm trong danh sách được phép`,
          });
        }

        // Check moneyMore hợp lệ
        if (typeof ap.moneyMore !== "number" || ap.moneyMore <= 0) {
          return res.status(400).json({
            success: false,
            message: `Giá trị phụ thu cho loại khách ${ap.typeOfPersonId} phải là số dương`,
          });
        }
      }
    }

    // === 5. Check description ===
    for (let d of data.description) {
      if (!d.title || !d.image || !d.description) {
        return res.status(400).json({
          success: false,
          message:
            "Mỗi ngày trong Mô tả lịch trình phải có đủ Tiêu đề, Ảnh và Nội dung",
        });
      }
    }

    // === Thành công ===
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
 * GET /api/v1/tours/admin/getTourById
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
      .populate("filter", "label value")
      .populate("frequency", "title")
      .populate("term.termId", "title icon")
      .populate("createdBy._id", "fullName")
      .populate("deletedBy._id", "fullName")
      .populate("updatedBy._id", "fullName")
      .lean();

    if (!tour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    res.status(200).json(tour);
  } catch (error) {
    console.error("Error fetching tour:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
