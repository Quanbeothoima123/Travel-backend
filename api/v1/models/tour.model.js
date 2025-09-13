const mongoose = require("mongoose");

const TourSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "TourCategory" },
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
    departPlaceId: { type: mongoose.Schema.Types.ObjectId, ref: "DepartPlace" },
    position: Number,
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
        termId: { type: mongoose.Schema.Types.ObjectId, ref: "Term" },
        description: String,
      },
    ],
    vehicleId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" }],
    slug: String,
    type: {
      type: String,
      enum: ["domestic", "aboard"],
    },
    active: Boolean,
    filter: [{ type: mongoose.Schema.Types.ObjectId, ref: "Filter" }],

    frequency: { type: mongoose.Schema.Types.ObjectId, ref: "Frequency" },
    specialExperience: String,

    allowTypePeople: [
      { type: mongoose.Schema.Types.ObjectId, ref: "TypeOfPerson" },
    ],

    additionalPrices: [
      {
        typeOfPersonId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TypeOfPerson",
        },
        moneyMore: { type: Number, default: 0 },
      },
    ],
    createdBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      at: { type: Date, default: Date.now },
    },
    deletedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
      at: { type: Date },
    },
    deleted: { type: Boolean, default: false },
    updatedBy: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminAccount" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Tour = mongoose.model("Tour", TourSchema, "tours");
module.exports = Tour;
