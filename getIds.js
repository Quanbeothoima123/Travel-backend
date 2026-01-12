// getIds.js
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// 🚀 Tự động load tất cả model trong thư mục ./api/v1/models
function loadAllModels() {
  const modelsDir = path.join(__dirname, "api/v1/models");

  fs.readdirSync(modelsDir).forEach((file) => {
    // Chỉ require file .js
    if (file.endsWith(".js")) {
      require(path.join(modelsDir, file));
      console.log(`📌 Loaded model file: ${file}`);
    }
  });
}

async function getAllIds(modelName) {
  try {
    // 👉 Kết nối MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log("🚀 Connected to MongoDB");

    // 👉 Load tất cả model
    loadAllModels();

    console.log(`🔍 Đang lấy _id từ model: ${modelName}`);

    // Lấy model đã được mongoose load
    const Model = mongoose.models[modelName];
    if (!Model) {
      console.error(`❌ Model "${modelName}" không tồn tại!`);
      console.error("📌 Gợi ý: kiểm tra tên model trong mongoose.model()");
      process.exit(1);
    }

    // Chỉ lấy _id
    const docs = await Model.find({}, { _id: 1 }).lean();
    const ids = docs.map((d) => d._id.toString());

    console.log(`📌 Tổng cộng: ${ids.length} _id`);
    console.log("----------------------------------------");
    console.log(ids);
    console.log("----------------------------------------");

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

// Lấy tên model từ CLI
const modelName = process.argv[2];

if (!modelName) {
  console.log("⚠️  Vui lòng truyền tên model. Ví dụ:");
  console.log("node getIds.js Tour");
  process.exit(1);
}

getAllIds(modelName);
