const mongoose = require("mongoose");

const AirportSchema = new mongoose.Schema(
  {
    airportId: {
      type: Number,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    cityName: {
      type: String,
      required: true,
    },
    countryName: {
      type: String,
      required: true,
    },
    iataCode: {
      type: String,
      sparse: true, // Cho phép null nhưng phải unique nếu có giá trị
      index: true,
    },
    icaoCode: {
      type: String,
      sparse: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    altitude: Number,
    timezone: Number,
    dst: String,
    tzDatabase: String,
    type: String,
    source: String,

    // Thêm keywords để tìm kiếm dễ dàng hơn
    keywords: {
      type: [String],
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "airports",
  }
);

// ✅ Index cho tìm kiếm text
AirportSchema.index({
  name: "text",
  cityName: "text",
  countryName: "text",
  iataCode: "text",
  icaoCode: "text",
});

// ✅ Index cho tìm kiếm gần nhất (geospatial)
AirportSchema.index({ latitude: 1, longitude: 1 });

// ✅ Method tạo keywords tự động
AirportSchema.methods.generateKeywords = function () {
  const keywords = new Set();

  // Thêm tên sân bay (loại bỏ "Airport", "International"...)
  if (this.name) {
    const cleanName = this.name
      .toLowerCase()
      .replace(/airport|international|intl|regional/gi, "")
      .trim();
    keywords.add(cleanName);
    keywords.add(this.name.toLowerCase());
  }

  // Thêm tên thành phố
  if (this.cityName) {
    keywords.add(this.cityName.toLowerCase());
  }

  // Thêm tên quốc gia
  if (this.countryName) {
    keywords.add(this.countryName.toLowerCase());
  }

  // Thêm mã IATA và ICAO
  if (this.iataCode) {
    keywords.add(this.iataCode.toLowerCase());
  }
  if (this.icaoCode) {
    keywords.add(this.icaoCode.toLowerCase());
  }

  return Array.from(keywords);
};

// ✅ Hook tự động tạo keywords trước khi save
AirportSchema.pre("save", function (next) {
  this.keywords = this.generateKeywords();
  next();
});

// ✅ Static method tìm kiếm sân bay
AirportSchema.statics.searchAirports = async function (keyword, limit = 10) {
  if (!keyword || keyword.length < 2) {
    return [];
  }

  const normalizedKeyword = keyword.toLowerCase().trim();

  // Tìm theo IATA code trước (ưu tiên cao nhất)
  if (/^[A-Z]{3}$/i.test(keyword)) {
    const exactMatch = await this.findOne({
      iataCode: keyword.toUpperCase(),
    });
    if (exactMatch) return [exactMatch];
  }

  // Tìm theo text search
  const results = await this.find(
    {
      $or: [
        { iataCode: new RegExp(`^${normalizedKeyword}`, "i") },
        { icaoCode: new RegExp(`^${normalizedKeyword}`, "i") },
        { keywords: new RegExp(normalizedKeyword, "i") },
        { name: new RegExp(normalizedKeyword, "i") },
        { cityName: new RegExp(normalizedKeyword, "i") },
      ],
    },
    {
      airportId: 1,
      name: 1,
      cityName: 1,
      countryName: 1,
      iataCode: 1,
      icaoCode: 1,
      latitude: 1,
      longitude: 1,
      type: 1,
    }
  )
    .sort({ iataCode: 1 }) // Ưu tiên sân bay có IATA code
    .limit(limit);

  return results;
};

// ✅ Static method tìm sân bay gần nhất
AirportSchema.statics.findNearest = async function (
  latitude,
  longitude,
  maxDistance = 100
) {
  // maxDistance tính bằng km
  const earthRadius = 6371; // km

  const airports = await this.find({
    iataCode: { $ne: null, $exists: true }, // Chỉ lấy sân bay có IATA code
  });

  // Tính khoảng cách và sắp xếp
  const airportsWithDistance = airports.map((airport) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      airport.latitude,
      airport.longitude
    );
    return { ...airport.toObject(), distance };
  });

  // Lọc và sắp xếp
  const nearestAirports = airportsWithDistance
    .filter((a) => a.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  return nearestAirports;
};

// Helper function tính khoảng cách (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

const Airport = mongoose.model("Airport", AirportSchema, "airports");

module.exports = Airport;
