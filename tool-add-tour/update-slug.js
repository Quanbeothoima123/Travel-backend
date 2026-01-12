const fs = require("fs");

// --- Hàm chuyển tiếng Việt có dấu thành không dấu ---
function removeVietnameseTones(str) {
  return str
    .normalize("NFD") // tách dấu
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

// --- Hàm tạo slug từ title ---
function slugify(title) {
  if (!title) return "unknown-slug";
  const noAccents = removeVietnameseTones(title);
  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // thay ký tự không phải chữ/số bằng '-'
    .replace(/(^-|-$)/g, ""); // bỏ '-' đầu/cuối
}

// --- Đọc file tours-complete.json ---
const filePath = "tours-complete.json";
const tours = JSON.parse(fs.readFileSync(filePath, "utf-8"));

// --- Update slug cho tất cả bản ghi ---
const updatedTours = tours.map((tour) => ({
  ...tour,
  slug: slugify(tour.title),
}));

// --- Ghi lại file ---
fs.writeFileSync(filePath, JSON.stringify(updatedTours, null, 2), "utf-8");

console.log(`✅ Đã update slug cho ${updatedTours.length} tour.`);
