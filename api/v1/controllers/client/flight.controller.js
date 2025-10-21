const Airport = require("../../models/airport.model");

// Helper: Lấy Amadeus token
const getAmadeusToken = async () => {
  try {
    const response = await fetch(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.AMADEUS_API_KEY,
          client_secret: process.env.AMADEUS_API_SECRET,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || "Không thể lấy token");
    }

    return data.access_token;
  } catch (error) {
    console.error("Error getting token:", error.message);
    throw new Error("Không thể xác thực với Amadeus API");
  }
};

// ✅ Tìm kiếm sân bay - DÙNG MONGODB (Nhanh và không giới hạn)
module.exports.searchAirports = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập ít nhất 2 ký tự",
      });
    }

    // Tìm kiếm trong MongoDB
    const airports = await Airport.searchAirports(keyword, 15);

    if (!airports || airports.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sân bay nào",
      });
    }

    // Format response giống Amadeus
    const locations = airports.map((airport) => ({
      iataCode: airport.iataCode || airport.icaoCode,
      name: airport.name,
      cityName: airport.cityName,
      countryName: airport.countryName,
      type: airport.type || "AIRPORT",
      latitude: airport.latitude,
      longitude: airport.longitude,
    }));

    return res.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Error searching airports:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm sân bay: " + error.message,
    });
  }
};

// ✅ Tìm sân bay gần nhất - DÙNG MONGODB
module.exports.getNearestAirport = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin vị trí",
      });
    }

    // Tìm trong MongoDB
    const nearestAirports = await Airport.findNearest(
      parseFloat(latitude),
      parseFloat(longitude),
      200 // Tìm trong bán kính 200km
    );

    if (!nearestAirports || nearestAirports.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sân bay gần bạn",
      });
    }

    const nearest = nearestAirports[0];

    return res.json({
      success: true,
      data: {
        iataCode: nearest.iataCode || "N/A",
        name: nearest.name,
        cityName: nearest.cityName,
        countryName: nearest.countryName,
        distance: Math.round(nearest.distance),
        hasValidIATA: nearest.iataCode !== null,
      },
    });
  } catch (error) {
    console.error("Error finding nearest airport:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm sân bay gần nhất: " + error.message,
    });
  }
};

// ✅ Tìm kiếm chuyến bay - DÙNG AMADEUS (với đầy đủ thông tin)
module.exports.searchFlights = async (req, res) => {
  try {
    const {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
      infants = 0,
      travelClass,
      nonStop,
      currencyCode = "VND",
      maxPrice,
    } = req.query;

    // Validation
    if (!originLocationCode || !destinationLocationCode || !departureDate) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin điểm đi, điểm đến hoặc ngày khởi hành",
      });
    }

    // Kiểm tra IATA code hợp lệ
    if (
      originLocationCode === "N/A" ||
      originLocationCode.length !== 3 ||
      !/^[A-Z]{3}$/.test(originLocationCode)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mã sân bay khởi hành không hợp lệ. Vui lòng chọn sân bay có mã IATA.",
      });
    }

    if (
      destinationLocationCode === "N/A" ||
      destinationLocationCode.length !== 3 ||
      !/^[A-Z]{3}$/.test(destinationLocationCode)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mã sân bay đến không hợp lệ. Vui lòng chọn sân bay có mã IATA.",
      });
    }

    const token = await getAmadeusToken();

    const url = new URL(
      "https://test.api.amadeus.com/v2/shopping/flight-offers"
    );
    url.searchParams.append("originLocationCode", originLocationCode);
    url.searchParams.append("destinationLocationCode", destinationLocationCode);
    url.searchParams.append("departureDate", departureDate);
    url.searchParams.append("adults", adults);
    url.searchParams.append("max", "50");

    if (returnDate) url.searchParams.append("returnDate", returnDate);
    if (children > 0) url.searchParams.append("children", children);
    if (infants > 0) url.searchParams.append("infants", infants);
    if (travelClass) url.searchParams.append("travelClass", travelClass);
    if (nonStop === "true" || nonStop === true)
      url.searchParams.append("nonStop", "true");
    if (currencyCode) url.searchParams.append("currencyCode", currencyCode);
    if (maxPrice) url.searchParams.append("maxPrice", maxPrice);

    console.log("Fetching flights from:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Amadeus API Error:", data);
      throw new Error(data.errors?.[0]?.detail || "Lỗi API");
    }

    if (!data.data || data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chuyến bay phù hợp",
      });
    }

    // ✅ TRẢ VỀ ĐẦY ĐỦ: LỊCH TRÌNH + GIÁ + THÔNG TIN HÀNH KHÁCH
    const flights = data.data.map((offer) => {
      const itineraries = offer.itineraries.map((itinerary) => {
        const segments = itinerary.segments.map((seg) => ({
          departure: {
            iataCode: seg.departure.iataCode,
            terminal: seg.departure.terminal,
            at: seg.departure.at,
          },
          arrival: {
            iataCode: seg.arrival.iataCode,
            terminal: seg.arrival.terminal,
            at: seg.arrival.at,
          },
          carrierCode: seg.carrierCode,
          number: seg.number,
          aircraft: seg.aircraft?.code || "N/A",
          duration: seg.duration,
          numberOfStops: seg.numberOfStops || 0,
        }));

        return {
          segments,
          duration: itinerary.duration,
        };
      });

      return {
        id: offer.id,
        type: offer.type,
        source: offer.source,
        oneWay: offer.oneWay,
        numberOfBookableSeats: offer.numberOfBookableSeats,
        itineraries,
        price: offer.price, // ✅ THÊM GIÁ
        travelerPricings: offer.travelerPricings, // ✅ THÊM THÔNG TIN HÀNH KHÁCH
        validatingAirlineCodes: offer.validatingAirlineCodes,
      };
    });

    res.json({
      success: true,
      meta: data.meta,
      data: flights,
      dictionaries: data.dictionaries, // ✅ TRẢ DICTIONARIES Ở ROOT
    });
  } catch (error) {
    console.error("Error searching flights:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm chuyến bay: " + error.message,
    });
  }
};

// ✅ Lấy chi tiết giá chuyến bay (nếu cần)
module.exports.getFlightPrice = async (req, res) => {
  try {
    const { flightOffer } = req.body;

    if (!flightOffer) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin chuyến bay",
      });
    }

    const token = await getAmadeusToken();

    const response = await fetch(
      "https://test.api.amadeus.com/v1/shopping/flight-offers/pricing",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            type: "flight-offers-pricing",
            flightOffers: [flightOffer],
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.detail || "Lỗi API");
    }

    res.json({
      success: true,
      data: data.data,
    });
  } catch (error) {
    console.error("Error getting flight price:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy giá chuyến bay: " + error.message,
    });
  }
};
