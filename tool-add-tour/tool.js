const fs = require("fs");
const readline = require("readline");
const path = require("path");

const filePath = path.join(__dirname, "name-term-des.json");
const imageFile = path.join(__dirname, "cloudinary-image-links.json");

// Đọc danh sách ảnh
const images = JSON.parse(fs.readFileSync(imageFile, "utf-8"));
function getRandomImage() {
  return images[Math.floor(Math.random() * images.length)];
}

// Backup file gốc
fs.copyFileSync(filePath, filePath + ".bak");
console.log("✅ Backup file gốc tạo thành công");

// Đọc file gốc theo dòng (giả sử JSON dạng mảng)
const fileContent = fs.readFileSync(filePath, "utf-8");
let data = JSON.parse(fileContent);

// Thay đổi từng bản ghi
data = data.map((record) => {
  const { name, ...rest } = record;
  const newRecord = { title: name, ...rest };

  if (Array.isArray(newRecord.description)) {
    newRecord.description = newRecord.description.map((day) => ({
      ...day,
      image: getRandomImage(),
    }));
  }

  return newRecord;
});

// Ghi trở lại file gốc
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
console.log(
  "✅ File đã được update trực tiếp với ảnh random và đổi name -> title"
);
