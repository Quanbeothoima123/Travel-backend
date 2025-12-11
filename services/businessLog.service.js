const fs = require("fs");
const path = require("path");
const BusinessLog = require("../../api/v1/models/business-log.model");

// Đường dẫn file log JSON
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "business.log");

// Đảm bảo folder logs tồn tại
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Ghi log vào file JSON
 */
function writeLogToFile(logData) {
  try {
    const logEntry =
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...logData,
      }) + "\n";

    fs.appendFileSync(LOG_FILE, logEntry, "utf8");
  } catch (error) {
    console.error("❌ Lỗi ghi log vào file:", error.message);
  }
}

/**
 * Ghi log vào MongoDB
 */
async function writeLogToMongo(logData) {
  try {
    await BusinessLog.create(logData);
  } catch (error) {
    console.error("❌ Lỗi ghi log vào MongoDB:", error.message);
  }
}

/**
 * HÀM CHÍNH - Ghi log nghiệp vụ (gọi từ controller)
 *
 * @param {Object} params
 * @param {ObjectId} params.adminId - ID của admin
 * @param {String} params.adminName - Tên admin
 * @param {String} params.action - Hành động: create, update, delete, restore, bulk_update
 * @param {String} params.model - Tên model: Tour, News, Gallery...
 * @param {Array} params.recordIds - Mảng IDs của các bản ghi bị ảnh hưởng
 * @param {String} params.description - Mô tả ngắn
 * @param {Object} params.details - Chi tiết thay đổi (optional)
 * @param {String} params.ip - IP address (optional)
 * @param {String} params.userAgent - User agent (optional)
 */
async function logBusiness({
  adminId,
  adminName,
  action,
  model,
  recordIds = [],
  description,
  details = null,
  ip = null,
  userAgent = null,
}) {
  const logData = {
    adminId,
    adminName,
    action,
    model,
    recordIds,
    description,
    details,
    ip,
    userAgent,
  };

  // Ghi vào file JSON (sync - nhanh)
  writeLogToFile(logData);

  // Ghi vào MongoDB (async - không chờ)
  writeLogToMongo(logData).catch((err) =>
    console.error("Log MongoDB failed:", err)
  );
}

module.exports = { logBusiness };
