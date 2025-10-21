require("dotenv").config();
const mongoose = require("mongoose");
const Airport = require("./api/v1/models/airport.model.js");

async function updateKeywords() {
  try {
    console.log("🔄 Đang kết nối MongoDB...");
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Đã kết nối MongoDB!");

    console.log("🔄 Đang lấy danh sách sân bay...");
    const airports = await Airport.find({});
    console.log(`📊 Tìm thấy ${airports.length} sân bay`);

    console.log("🔄 Đang cập nhật keywords...");
    let updated = 0;

    for (const airport of airports) {
      airport.keywords = airport.generateKeywords();
      await airport.save();
      updated++;

      // Hiển thị tiến trình
      if (updated % 100 === 0) {
        console.log(`   ⏳ Đã cập nhật ${updated}/${airports.length}...`);
      }
    }

    console.log(`✅ Hoàn thành! Đã cập nhật ${updated} sân bay`);
    console.log("\n📋 Ví dụ keywords:");
    const sample = airports.slice(0, 3);
    sample.forEach((a) => {
      console.log(`   ${a.iataCode || a.icaoCode} - ${a.name}`);
      console.log(`   Keywords: ${a.keywords.join(", ")}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error.message);
    process.exit(1);
  }
}

updateKeywords();
