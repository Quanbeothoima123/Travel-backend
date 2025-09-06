const mongoose = require("mongoose");
const TourCategory = require("../../api/v1/models/tour-category.model");
const TravelTime = require("../../api/v1/models/travel-time.model");
const Hotel = require("../../api/v1/models/hotel.model");
const Frequency = require("../../api/v1/models/frequency.model");
const Vehicle = require("../../api/v1/models/vehicle.model");
const Term = require("../../api/v1/models/term.model");
const TypeOfPerson = require("../../api/v1/models/type-of-person.model");
const Filter = require("../../api/v1/models/filter.model");
// Hàm tiện ích check ObjectId có tồn tại
const checkExists = async (Model, id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`"${label}" không hợp lệ`);
  }
  const exists = await Model.findById(id);
  if (!exists) throw new Error(`"${label}" không tồn tại`);
};

const validateTourData = async (data) => {
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
    { field: "filterId", label: "Filter" },
    { field: "active", label: "Trạng thái" },
    { field: "position", label: "Vị trí" },
    { field: "thumbnail", label: "Ảnh bìa" },
    { field: "images", label: "Thư viện ảnh" },
    { field: "departPlaces", label: "Nơi khởi hành" },
    { field: "tags", label: "Tags" },
    { field: "term", label: "Điều khoản" },
    { field: "description", label: "Mô tả lịch trình" },
    { field: "specialExperience", label: "Trải nghiệm đặc biệt" },
    // additionalPrices: để optional
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

  if (data.discount < 0 || data.discount > 100) {
    return res.status(400).json({
      success: false,
      message: `Trường "Giảm giá" phải nằm trong khoảng từ 0% đến 100%`,
    });
  }

  if (data.prices < 0) {
    return res.status(400).json({
      success: false,
      message: `Trường "Giá" có giá trị không âm`,
    });
  }

  if (data.seats < 0) {
    return res.status(400).json({
      success: false,
      message: `Trường "Số ghế" có giá trị từ 1 trở lên`,
    });
  }

  // === 2. Check enum cho type ===
  const allowedTypes = ["domestic", "aboard"];
  if (!allowedTypes.includes(data.type)) {
    throw new Error(
      `Trường "Loại tour" chỉ chấp nhận: ${allowedTypes.join(", ")}`
    );
  }

  // === 3. Check tồn tại ID trong DB ===
  await checkExists(TourCategory, data.categoryId, "Danh mục");
  await checkExists(TravelTime, data.travelTimeId, "Thời gian tour");
  await checkExists(Hotel, data.hotelId, "Khách sạn");
  await checkExists(Frequency, data.frequency, "Tần suất");

  for (let vId of data.vehicleId) {
    await checkExists(Vehicle, vId, "Phương tiện");
  }

  for (let t of data.term) {
    await checkExists(Term, t.termId, "Điều khoản");
  }

  if (
    Array.isArray(data.additionalPrices) &&
    data.additionalPrices.length > 0
  ) {
    for (let ap of data.additionalPrices) {
      await checkExists(TypeOfPerson, ap.typeOfPersonId, "Loại khách");
    }
  }

  if (Array.isArray(data.filterId) && data.filterId.length > 0) {
    for (let fId of data.filterId) {
      await checkExists(Filter, fId, "Filter");
    }
  }

  // === 4. Check DescriptionEditor ===
  for (let d of data.description) {
    if (!d.title || !d.image || !d.description) {
      throw new Error(
        "Mỗi ngày trong Mô tả lịch trình phải có đủ Tiêu đề, Ảnh và Nội dung"
      );
    }
  }

  return true;
};

// Middleware cho Express
module.exports.validateCreateTour = async (req, res, next) => {
  try {
    await validateTourData(req.body);
    next();
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Xuất thêm để tái sử dụng trong controller khác (ví dụ checkTour)
module.exports.validateTourData = validateTourData;

module.exports.validateUpdateCategory = async (req, res, next) => {
  const { id } = req.params;
  const { title, parentId, slug, active } = req.body;
  let errors = [];

  // Validate id
  if (!mongoose.Types.ObjectId.isValid(id)) {
    errors.push({ field: "id", message: "ID không hợp lệ" });
  }

  // Validate title
  if (title !== undefined) {
    if (title.trim() === "") {
      errors.push({ field: "title", message: "Tiêu đề không được để trống" });
    } else if (title.length < 3 || title.length > 100) {
      errors.push({
        field: "title",
        message: "Tiêu đề phải từ 3 đến 100 ký tự",
      });
    }
  }

  // Validate parentId
  if (parentId && parentId !== "") {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      errors.push({ field: "parentId", message: "parentId không hợp lệ" });
    }
  }

  // Validate slug (nếu người dùng nhập)
  if (slug !== undefined && slug.trim() === "") {
    errors.push({ field: "slug", message: "Slug không được để trống" });
  }

  // Validate active
  if (active !== undefined && typeof active !== "boolean") {
    errors.push({
      field: "active",
      message: "Trường active phải là true hoặc false",
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: "Dữ liệu cập nhật danh mục không hợp lệ",
      errors,
    });
  }

  next();
};
