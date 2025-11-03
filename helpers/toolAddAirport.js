const mongoose = require("mongoose");
const fs = require("fs");
const readline = require("readline");
const path = require("path");
const Airport = require("../api/v1/models/airport.model");

// ✅ CẤU HÌNH - Thay đổi ở đây
const CONFIG = {
  // Thay bằng MongoDB connection string của bạn
  MONGODB_URI: process.env.MONGODB_URI,

  // File dữ liệu airports (đặt file airports.txt vào thư mục data/)
  DATA_FILE: path.join(__dirname, "../data/airports.txt"),

  // Batch size (import từng lô để tránh quá tải)
  BATCH_SIZE: 1000,
};

// ✅ Parse dòng CSV thành object
function parseAirportLine(line) {
  // Format: id,"name","city","country","iata","icao",lat,lng,alt,tz,dst,"tzdb","type","source"

  // Split theo dấu phẩy nhưng giữ nguyên nội dung trong dấu ngoặc kép
  const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
  const fields = line.split(regex).map((f) => f.replace(/^"|"$/g, "").trim());

  if (fields.length < 14) {
    console.warn(`⚠️  Dòng không hợp lệ: ${line}`);
    return null;
  }

  return {
    airportId: parseInt(fields[0]),
    name: fields[1],
    cityName: fields[2],
    countryName: fields[3],
    iataCode: fields[4] === "\\N" || !fields[4] ? null : fields[4],
    icaoCode: fields[5] === "\\N" || !fields[5] ? null : fields[5],
    latitude: parseFloat(fields[6]),
    longitude: parseFloat(fields[7]),
    altitude: parseInt(fields[8]) || 0,
    timezone: parseFloat(fields[9]) || 0,
    dst: fields[10],
    tzDatabase: fields[11],
    type: fields[12],
    source: fields[13],
  };
}

// ✅ Import dữ liệu vào MongoDB
async function importAirports() {
  console.log("🚀 Bắt đầu import dữ liệu sân bay...\n");

  try {
    // Kết nối MongoDB
    console.log(`📡 Đang kết nối MongoDB: ${CONFIG.MONGODB_URI}`);
    await mongoose.connect(CONFIG.MONGODB_URI);
    console.log("✅ Kết nối MongoDB thành công!\n");

    // Kiểm tra file tồn tại
    if (!fs.existsSync(CONFIG.DATA_FILE)) {
      throw new Error(
        `❌ Không tìm thấy file: ${CONFIG.DATA_FILE}\n\nVui lòng tải file airports.dat từ:\nhttps://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat\n\nVà lưu vào: ${CONFIG.DATA_FILE}`
      );
    }

    // Xóa dữ liệu cũ (nếu có)
    const oldCount = await Airport.countDocuments();
    if (oldCount > 0) {
      console.log(`🗑️  Đang xóa ${oldCount} sân bay cũ...`);
      await Airport.deleteMany({});
      console.log("✅ Đã xóa dữ liệu cũ\n");
    }

    // Đọc file và parse
    const fileStream = fs.createReadStream(CONFIG.DATA_FILE);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let batch = [];
    let totalProcessed = 0;
    let totalImported = 0;
    let errors = 0;

    console.log("📖 Đang đọc và import dữ liệu...\n");

    for await (const line of rl) {
      totalProcessed++;

      const airport = parseAirportLine(line);

      if (airport) {
        batch.push(airport);

        // Import theo batch
        if (batch.length >= CONFIG.BATCH_SIZE) {
          try {
            await Airport.insertMany(batch, { ordered: false });
            totalImported += batch.length;
            console.log(`✅ Đã import ${totalImported} sân bay...`);
          } catch (err) {
            // Bỏ qua lỗi duplicate
            const inserted = batch.length - (err.writeErrors?.length || 0);
            totalImported += inserted;
            errors += err.writeErrors?.length || 0;
            console.log(
              `⚠️  Batch có ${
                err.writeErrors?.length || 0
              } lỗi, đã import ${inserted} sân bay`
            );
          }
          batch = [];
        }
      } else {
        errors++;
      }

      // Hiển thị tiến trình mỗi 5000 dòng
      if (totalProcessed % 5000 === 0) {
        console.log(`📊 Đã xử lý ${totalProcessed} dòng...`);
      }
    }

    // Import batch cuối cùng
    if (batch.length > 0) {
      try {
        await Airport.insertMany(batch, { ordered: false });
        totalImported += batch.length;
      } catch (err) {
        const inserted = batch.length - (err.writeErrors?.length || 0);
        totalImported += inserted;
        errors += err.writeErrors?.length || 0;
      }
    }

    // Tạo indexes
    console.log("\n🔧 Đang tạo indexes...");
    await Airport.createIndexes();

    // Thống kê
    const stats = await getStatistics();

    console.log("\n" + "=".repeat(60));
    console.log("🎉 HOÀN THÀNH IMPORT!");
    console.log("=".repeat(60));
    console.log(`📊 Tổng dòng xử lý:        ${totalProcessed}`);
    console.log(`✅ Import thành công:      ${totalImported}`);
    console.log(`❌ Lỗi:                    ${errors}`);
    console.log(`\n📍 Thống kê database:`);
    console.log(`   - Tổng sân bay:         ${stats.total}`);
    console.log(`   - Có IATA code:         ${stats.withIATA}`);
    console.log(`   - Có ICAO code:         ${stats.withICAO}`);
    console.log(`   - Top 5 quốc gia:`);
    stats.topCountries.forEach((c, i) => {
      console.log(`     ${i + 1}. ${c._id}: ${c.count} sân bay`);
    });
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ LỖI:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Đã ngắt kết nối MongoDB");
  }
}

// ✅ Lấy thống kê
async function getStatistics() {
  const total = await Airport.countDocuments();
  const withIATA = await Airport.countDocuments({ iataCode: { $ne: null } });
  const withICAO = await Airport.countDocuments({ icaoCode: { $ne: null } });

  const topCountries = await Airport.aggregate([
    { $group: { _id: "$countryName", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  return { total, withIATA, withICAO, topCountries };
}

// ✅ Test tìm kiếm sau khi import
async function testSearch() {
  console.log("\n🔍 TEST TÌM KIẾM:\n");

  await mongoose.connect(CONFIG.MONGODB_URI);

  const testQueries = ["hanoi", "HAN", "saigon", "SGN", "bangkok", "singapore"];

  for (const query of testQueries) {
    const results = await Airport.searchAirports(query, 3);
    console.log(`\n"${query}" → Tìm thấy ${results.length} kết quả:`);
    results.forEach((r) => {
      console.log(
        `  - ${r.iataCode || "N/A"} | ${r.name} | ${r.cityName}, ${
          r.countryName
        }`
      );
    });
  }

  await mongoose.disconnect();
}

// ✅ Chạy script
const command = process.argv[2];

if (command === "test") {
  testSearch();
} else if (command === "import") {
  importAirports();
} else {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         TOOL IMPORT DỮ LIỆU SÂN BAY VÀO MONGODB           ║
╚═══════════════════════════════════════════════════════════╝

📝 HƯỚNG DẪN SỬ DỤNG:

1️⃣  Tải file dữ liệu sân bay:
   https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat
   
2️⃣  Tạo thư mục data/ và lưu file thành airports.txt:
   mkdir -p data
   # Copy file airports.dat vào data/airports.txt
   
3️⃣  Cấu hình MongoDB connection (trong file này):
   MONGODB_URI = "mongodb://localhost:27017/flight_booking"
   Hoặc set biến môi trường:
   export MONGODB_URI="mongodb://..."
   
4️⃣  Chạy import:
   node tools/importAirports.js import
   
5️⃣  Test tìm kiếm:
   node tools/importAirports.js test

═══════════════════════════════════════════════════════════

🔧 CÁC LỆNH:

  node tools/importAirports.js import   → Import dữ liệu
  node tools/importAirports.js test     → Test tìm kiếm

═══════════════════════════════════════════════════════════
  `);
}
