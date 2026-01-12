require("dotenv").config();
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: "dtzrnyzcl",
  api_key: 488711767567497,
  api_secret: "XfctAS4A3XmTslAvf7CaTU_VqKA",
});

async function exportImageLinks() {
  try {
    let allResources = [];
    let nextCursor = null;

    console.log("🔍 Đang lấy danh sách ảnh từ Cloudinary...");

    // Lấy toàn bộ ảnh bằng phân trang tự động
    do {
      const res = await cloudinary.api.resources({
        resource_type: "image",
        max_results: 500,
        next_cursor: nextCursor,
      });

      allResources = [...allResources, ...res.resources];
      nextCursor = res.next_cursor;

      console.log(`📸 Lấy thêm ${res.resources.length} ảnh...`);
    } while (nextCursor);

    console.log(`✅ Tổng số ảnh: ${allResources.length}`);

    // 🟡 Sắp xếp theo thời gian upload giảm dần
    allResources.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // 🟢 Chỉ lấy link ảnh
    const imageLinks = allResources.map((img) => img.secure_url);

    // 🟢 Xuất file JSON
    fs.writeFileSync(
      "cloudinary-image-links.json",
      JSON.stringify(imageLinks, null, 2)
    );

    console.log("📁 File đã được tạo: cloudinary-image-links.json");
  } catch (err) {
    console.error("❌ Lỗi:", err);
  }
}

exportImageLinks();
