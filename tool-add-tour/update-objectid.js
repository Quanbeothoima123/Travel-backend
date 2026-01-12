const fs = require("fs");

// Kiểm tra string có phải ObjectId hợp lệ
function isValidObjectIdString(str) {
  return typeof str === "string" && /^[0-9a-fA-F]{24}$/.test(str);
}

// Danh sách các field cần convert theo schema
const OBJECTID_FIELDS = new Set([
  "categoryId",
  "travelTimeId",
  "hotelId",
  "departPlaceId",
  "vehicleId",
  "filterId",
  "frequency",
  "allowTypePeople",
  "termId",
  "typeOfPersonId",
  "_id",
]);

// Convert sang MongoDB Extended JSON format
function convertToExtendedJSON(obj, parentKey = "") {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertToExtendedJSON(item, parentKey));
  } else if (obj && typeof obj === "object") {
    const result = {};
    for (const key in obj) {
      const value = obj[key];

      // Nếu field này cần convert và value là string hợp lệ
      if (OBJECTID_FIELDS.has(key) && isValidObjectIdString(value)) {
        result[key] = { $oid: value };
      }
      // Nếu là array các ObjectId
      else if (OBJECTID_FIELDS.has(key) && Array.isArray(value)) {
        result[key] = value.map((item) =>
          isValidObjectIdString(item)
            ? { $oid: item }
            : convertToExtendedJSON(item, key)
        );
      }
      // Nested object (như createdBy._id, deletedBy._id)
      else if (key === "_id" && isValidObjectIdString(value)) {
        result[key] = { $oid: value };
      }
      // Đệ quy cho các object khác
      else {
        result[key] = convertToExtendedJSON(value, key);
      }
    }
    return result;
  } else {
    return obj;
  }
}

// Main function
function run() {
  const inputFile = "tours-complete.json";
  const outputFile = "tours-updated.json";

  if (!fs.existsSync(inputFile)) {
    console.error("❌ Không tìm thấy file", inputFile);
    return;
  }

  console.log("📖 Đang đọc file...");
  const json = JSON.parse(fs.readFileSync(inputFile, "utf8"));

  console.log(`🔍 Tìm thấy ${json.length} bản ghi`);
  console.log("🔄 Đang convert ObjectId...");

  const updated = json.map((tour) => convertToExtendedJSON(tour));

  fs.writeFileSync(outputFile, JSON.stringify(updated, null, 2), "utf8");

  console.log(`✅ Hoàn tất! Đã convert ${updated.length} bản ghi`);
  console.log(`📄 File đầu ra: ${outputFile}`);

  // Show sample
  console.log("\n📋 Mẫu bản ghi đầu tiên:");
  console.log(JSON.stringify(updated[0], null, 2).substring(0, 500) + "...");
}

run();
