const fs = require("fs");

// --- Load lookup files ---
const lookup = JSON.parse(fs.readFileSync("lookup.json", "utf-8"));
const {
  TourCategory,
  TravelTime,
  Hotel,
  DepartPlace,
  Term,
  Vehicle,
  Filter,
  Frequency,
  TypeOfPerson,
  AdminAccount,
} = lookup;

// --- Load Cloudinary images ---
const cloudinaryImages = JSON.parse(
  fs.readFileSync("cloudinary-image-links.json", "utf-8")
);

// --- Get all JSON tour files in current folder ---
const tourFiles = fs
  .readdirSync(".")
  .filter(
    (f) =>
      f.endsWith(".json") &&
      ![
        "lookup.json",
        "cloudinary-image-links.json",
        "tours-complete.json",
      ].includes(f)
  );

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const slugify = (text) =>
  text
    ? text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    : "unknown-slug";

let toursComplete = [];

tourFiles.forEach((file) => {
  const fileData = JSON.parse(fs.readFileSync(file, "utf-8"));
  // fileData có thể là array hoặc object
  const tourArray = Array.isArray(fileData) ? fileData : [fileData];

  tourArray.forEach((tourData, index) => {
    const allowTypePeople = Array.from({ length: 2 }, () =>
      getRandomItem(TypeOfPerson)
    );

    const additionalPrices = allowTypePeople.map((id) => ({
      typeOfPersonId: id,
      moneyMore: Math.floor(Math.random() * 1000000),
    }));

    const thumbnail = getRandomItem(cloudinaryImages);
    const images = Array.from({ length: 3 }, (_, i) => ({
      url: getRandomItem(cloudinaryImages),
      index: i + 1,
    }));

    toursComplete.push({
      categoryId: getRandomItem(TourCategory),
      title: tourData.title || `Tour ${index + 1}`,
      slug: slugify(tourData.title),
      thumbnail,
      images,
      travelTimeId: getRandomItem(TravelTime),
      hotelId: getRandomItem(Hotel),
      departPlaceId: getRandomItem(DepartPlace),
      position: toursComplete.length + 1,
      prices: Math.floor(Math.random() * 5000000) + 1000000,
      discount: Math.floor(Math.random() * 50),
      tags: ["hot", "new", "popular"]
        .sort(() => 0.5 - Math.random())
        .slice(0, 2),
      seats: Math.floor(Math.random() * 30) + 10,
      description: tourData.description || [],
      term: (tourData.term || []).map((t) => ({
        termId: t.termId,
        description: t.description,
      })),
      vehicleId: Array.from({ length: 2 }, () => getRandomItem(Vehicle)),
      type: Math.random() > 0.5 ? "domestic" : "aboard",
      active: true,
      filterId: Array.from({ length: 2 }, () => getRandomItem(Filter)),
      frequency: getRandomItem(Frequency),
      specialExperience: tourData.specialExperience || "",
      allowTypePeople,
      additionalPrices,
      createdBy: { _id: getRandomItem(AdminAccount), at: new Date() },
      deletedBy: null,
      deleted: false,
      updatedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
});

fs.writeFileSync(
  "tours-complete.json",
  JSON.stringify(toursComplete, null, 2),
  "utf-8"
);

console.log(
  "✅ Generated tours-complete.json with",
  toursComplete.length,
  "tours."
);
