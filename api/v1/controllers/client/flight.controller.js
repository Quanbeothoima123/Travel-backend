const axios = require("axios");

// Amadeus API Authentication
let amadeusToken = null;
let tokenExpiry = null;

const getAmadeusToken = async () => {
  if (amadeusToken && tokenExpiry && Date.now() < tokenExpiry) {
    return amadeusToken;
  }

  try {
    const response = await axios.post(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    amadeusToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000;
    return amadeusToken;
  } catch (error) {
    throw new Error("Không thể xác thực với Amadeus API");
  }
};

// Tìm kiếm sân bay với autocomplete
module.exports.searchAirports = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập ít nhất 2 ký tự",
      });
    }

    const token = await getAmadeusToken();
    const response = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations",
      {
        params: {
          subType: "AIRPORT,CITY",
          keyword: keyword,
          page: { limit: 10 },
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const locations = response.data.data.map((loc) => ({
      iataCode: loc.iataCode,
      name: loc.name,
      cityName: loc.address?.cityName || "",
      countryName: loc.address?.countryName || "",
      type: loc.subType,
    }));

    res.json({ success: true, data: locations });
  } catch (error) {
    console.error("Error searching airports:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm sân bay",
    });
  }
};

// Tìm sân bay gần nhất theo tọa độ
module.exports.getNearestAirport = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin vị trí",
      });
    }

    const token = await getAmadeusToken();
    const response = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations/airports",
      {
        params: {
          latitude,
          longitude,
          radius: 100,
          page: { limit: 1 },
          sort: "relevance",
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.data.data || response.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sân bay gần bạn",
      });
    }

    const airport = response.data.data[0];
    res.json({
      success: true,
      data: {
        iataCode: airport.iataCode,
        name: airport.name,
        cityName: airport.address?.cityName || "",
        countryName: airport.address?.countryName || "",
      },
    });
  } catch (error) {
    console.error("Error finding nearest airport:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm sân bay gần nhất",
    });
  }
};

// Tìm kiếm chuyến bay với nhiều options
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

    const token = await getAmadeusToken();
    const params = {
      originLocationCode,
      destinationLocationCode,
      departureDate,
      adults,
      max: 50,
    };

    if (returnDate) params.returnDate = returnDate;
    if (children > 0) params.children = children;
    if (infants > 0) params.infants = infants;
    if (travelClass) params.travelClass = travelClass;
    if (nonStop === "true") params.nonStop = true;
    if (currencyCode) params.currencyCode = currencyCode;
    if (maxPrice) params.maxPrice = maxPrice;

    const response = await axios.get(
      "https://test.api.amadeus.com/v2/shopping/flight-offers",
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.data.data || response.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chuyến bay phù hợp",
      });
    }

    // Format dữ liệu chi tiết
    const flights = response.data.data.map((offer) => {
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

      const price = offer.price;
      const travelerPricings = offer.travelerPricings.map((tp) => ({
        travelerId: tp.travelerId,
        fareOption: tp.fareOption,
        travelerType: tp.travelerType,
        price: tp.price,
        fareDetailsBySegment: tp.fareDetailsBySegment.map((fd) => ({
          segmentId: fd.segmentId,
          cabin: fd.cabin,
          class: fd.class,
          includedCheckedBags: fd.includedCheckedBags,
        })),
      }));

      return {
        id: offer.id,
        type: offer.type,
        source: offer.source,
        instantTicketingRequired: offer.instantTicketingRequired,
        nonHomogeneous: offer.nonHomogeneous,
        oneWay: offer.oneWay,
        lastTicketingDate: offer.lastTicketingDate,
        numberOfBookableSeats: offer.numberOfBookableSeats,
        itineraries,
        price: {
          currency: price.currency,
          total: price.total,
          base: price.base,
          fees: price.fees || [],
          grandTotal: price.grandTotal,
        },
        pricingOptions: offer.pricingOptions,
        validatingAirlineCodes: offer.validatingAirlineCodes,
        travelerPricings,
      };
    });

    // Thêm thông tin dictionary (airline names)
    const dictionaries = response.data.dictionaries || {};

    res.json({
      success: true,
      meta: response.data.meta,
      data: flights,
      dictionaries,
    });
  } catch (error) {
    console.error(
      "Error searching flights:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.errors?.[0]?.detail ||
        "Lỗi khi tìm kiếm chuyến bay",
    });
  }
};

// Lấy chi tiết giá chuyến bay (Flight Offer Price)
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
    const response = await axios.post(
      "https://test.api.amadeus.com/v1/shopping/flight-offers/pricing",
      {
        data: {
          type: "flight-offers-pricing",
          flightOffers: [flightOffer],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      data: response.data.data,
    });
  } catch (error) {
    console.error("Error getting flight price:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy giá chuyến bay",
    });
  }
};
