const mongoose = require("mongoose");
const TourCategory = require("../../api/v1/models/tour-category.model");
const TravelTime = require("../../api/v1/models/travel-time.model");
const Hotel = require("../../api/v1/models/hotel.model");
const Frequency = require("../../api/v1/models/frequency.model");
const Vehicle = require("../../api/v1/models/vehicle.model");
const Term = require("../../api/v1/models/term.model");
const TypeOfPerson = require("../../api/v1/models/type-of-person.model");
const Filter = require("../../api/v1/models/filter.model");
const DepartPlace = require("../../api/v1/models/depart-place.model");
const Tour = require("../../api/v1/models/tour.model");
// Hàm tiện ích check ObjectId có tồn tại
// ==== Helper: lấy id thật (có thể từ object {_id,...} hoặc string) ====
const extractId = (value) => {
  if (!value) return null;
  return typeof value === "object" && value._id ? value._id : value;
};

const checkExists = async (Model, id, label) => {
  const realId = extractId(id);
  if (!mongoose.Types.ObjectId.isValid(realId)) {
    throw new Error(`"${label}" không hợp lệ`);
  }
  const exists = await Model.findById(realId);
  if (!exists) throw new Error(`"${label}" không tồn tại`);
  return realId;
};

// ================== Core validate (không check slug uniqueness) ==================
const validateTourData = async (data) => {
  // 1. Trường bắt buộc
  const requiredFields = [
    { field: "title", label: "Tên tour" },
    { field: "slug", label: "Slug" },
    { field: "categoryId", label: "Danh mục" },
    { field: "travelTimeId", label: "Thời gian tour" },
    { field: "hotelId", label: "Khách sạn" },
    { field: "departPlaceId", label: "Nơi khởi hành" },
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
      throw new Error(`Trường "${label}" không được để trống`);
    }
  }

  // 2. Validate số
  if (data.discount < 0 || data.discount > 100) {
    throw new Error(`Trường "Giảm giá" phải nằm trong khoảng 0 - 100`);
  }
  if (data.prices < 0) {
    throw new Error(`Trường "Giá tour" phải >= 0`);
  }
  if (data.seats <= 0) {
    throw new Error(`Trường "Số ghế" phải >= 1`);
  }

  // 3. Enum type
  const allowedTypes = ["domestic", "aboard"];
  if (!allowedTypes.includes(data.type)) {
    throw new Error(
      `Trường "Loại tour" chỉ chấp nhận: ${allowedTypes.join(", ")}`
    );
  }

  // 4. Check tồn tại ID + chuẩn hóa
  data.categoryId = await checkExists(
    TourCategory,
    data.categoryId,
    "Danh mục"
  );
  data.travelTimeId = await checkExists(
    TravelTime,
    data.travelTimeId,
    "Thời gian tour"
  );
  data.hotelId = await checkExists(Hotel, data.hotelId, "Khách sạn");
  data.frequency = await checkExists(Frequency, data.frequency, "Tần suất");
  data.departPlaceId = await checkExists(
    DepartPlace,
    data.departPlaceId,
    "Nơi khởi hành"
  );

  data.vehicleId = await Promise.all(
    data.vehicleId.map((v) => checkExists(Vehicle, v, "Phương tiện"))
  );

  data.filterId = await Promise.all(
    data.filterId.map((f) => checkExists(Filter, f, "Bộ lọc"))
  );

  // Term
  if (!Array.isArray(data.term) || data.term.length === 0) {
    throw new Error(`Trường "Điều khoản" không được để trống`);
  }
  for (let t of data.term) {
    if (!t.termId || !t.description || String(t.description).trim() === "") {
      throw new Error(`Mỗi điều khoản phải có đủ "termId" và "description"`);
    }
    t.termId = await checkExists(Term, t.termId, "Điều khoản");
  }

  // AllowTypePeople
  if (Array.isArray(data.allowTypePeople)) {
    data.allowTypePeople = await Promise.all(
      data.allowTypePeople.map((p) =>
        checkExists(TypeOfPerson, p, "Loại khách")
      )
    );
  }

  // AdditionalPrices
  if (Array.isArray(data.additionalPrices)) {
    for (let ap of data.additionalPrices) {
      ap.typeOfPersonId = await checkExists(
        TypeOfPerson,
        ap.typeOfPersonId,
        "Loại khách (phụ thu)"
      );
      if (typeof ap.moneyMore !== "number" || ap.moneyMore < 0) {
        throw new Error(
          `Giá trị phụ thu cho loại khách ${ap.typeOfPersonId} phải là số >= 0`
        );
      }
    }
  }

  // 5. Check description từng ngày
  for (let d of data.description) {
    if (!d.title || !d.image || !d.description) {
      throw new Error(
        `Mỗi ngày trong "Mô tả lịch trình" phải có đủ Tiêu đề, Ảnh và Nội dung`
      );
    }
  }

  return data; // đã chuẩn hóa id
};

// ================== Middleware cho CREATE (có check slug unique) ==================
const validateCreateTour = async (req, res, next) => {
  try {
    // validate chung + chuẩn hóa ids
    req.body = await validateTourData(req.body);

    // check slug unique
    const slug = req.body.slug;
    if (slug) {
      const existing = await Tour.findOne({ slug: slug });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: `Slug "${slug}" đã tồn tại` });
      }
    }

    next();
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ================== Middleware cho UPDATE (check slug unique ngoại trừ chính tour) ==================
const validateUpdateTour = async (req, res, next) => {
  try {
    const tourId = req.params.tourId;
    if (!mongoose.Types.ObjectId.isValid(tourId)) {
      return res
        .status(400)
        .json({ success: false, message: "tourId không hợp lệ" });
    }

    const existingTour = await Tour.findById(tourId);
    if (!existingTour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour cần cập nhật không tồn tại" });
    }

    // validate chung + chuẩn hóa ids (nội dung body vẫn phải đầy đủ như create)
    req.body = await validateTourData(req.body);

    // check slug uniqueness excluding current tour
    const slug = req.body.slug;
    if (slug) {
      const other = await Tour.findOne({ slug: slug, _id: { $ne: tourId } });
      if (other) {
        return res
          .status(400)
          .json({ success: false, message: `Slug "${slug}" đã được sử dụng` });
      }
    }

    next();
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  validateTourData,
  validateCreateTour,
  validateUpdateTour,
};
