const mongoose = require("mongoose");

const TourSchema = new mongoose.Schema({
  categoryId: [{ type: mongoose.Schema.Types.ObjectId, ref: "TourCategory" }],
  title: String,
  thumbnail: String,
  images: [
    {
      url: String,
      index: Number,
    },
  ],
  travelTimeId: { type: mongoose.Schema.Types.ObjectId, ref: "TravelTime" },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel" },
  departPlaces: [
    {
      place: String,
      googleMap: String,
    },
  ],
  prices: Number,
  discount: Number,
  tags: [String],
  seats: Number,
  description: [
    {
      day: Number,
      title: String,
      image: String,
      description: String,
    },
  ],
  term: [
    {
      index: Number,
      termId: { type: mongoose.Schema.Types.ObjectId, ref: "Term" },
      description: String,
    },
  ],
  createdAt: Date,
  updatedAt: Date,
  vehicleId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" }],
  slug: String,
  type: String,
  frequency: { type: mongoose.Schema.Types.ObjectId, ref: "Frequency" },
  specialExperience: String,
});

const Tour = mongoose.model("Tour", TourSchema, "tours");
module.exports = Tour;
