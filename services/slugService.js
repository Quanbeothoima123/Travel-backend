const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Chuyển đổi một chuỗi thành một chuỗi "slug" thân thiện với URL bằng AI.
 * Có cơ chế dự phòng, tự chuyển về hàm thủ công nếu AI lỗi.
 * @param {string} title - Chuỗi đầu vào, thường là tiêu đề bài viết.
 * @returns {Promise<string>} - Chuỗi đã được chuyển đổi thành slug.
 */
async function generateSlug(title) {
  // Trả về chuỗi rỗng nếu không có tiêu đề
  if (!title) {
    return "";
  }

  try {
    // Sử dụng model 'gemini-1.5-flash' để có tốc độ nhanh và hiệu quả
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt yêu cầu AI tạo ra một slug chuẩn SEO với các quy tắc rõ ràng
    const prompt = `Từ tiêu đề sau: "${title}", hãy tạo một chuỗi slug duy nhất, thân thiện với URL cho mục đích SEO.
    Yêu cầu quan trọng:
    1. Viết thường toàn bộ chuỗi.
    2. Loại bỏ tất cả dấu tiếng Việt.
    3. Thay thế mọi khoảng trắng bằng một dấu gạch ngang (-).
    4. Xóa tất cả các ký tự đặc biệt (chỉ giữ lại chữ cái, số, và dấu gạch ngang).
    5. Chỉ trả về chuỗi slug cuối cùng, không kèm theo bất kỳ giải thích nào.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let slug = response.text().trim();

    // Thêm một bước dọn dẹp cuối cùng để đảm bảo slug AI trả về luôn hợp lệ
    return slug
      .toLowerCase()
      .replace(/\s+/g, "-") // Đảm bảo các khoảng trắng còn sót lại được thay thế
      .replace(/[^a-z0-9-]/g, ""); // Xóa mọi thứ không phải chữ, số, hoặc gạch ngang
  } catch (error) {
    console.error(
      "Lỗi khi tạo slug bằng Gemini API. Sử dụng hàm dự phòng.",
      error
    );
    // --- CƠ CHẾ DỰ PHÒNG ---
    // Nếu AI lỗi, dùng lại hàm tạo slug thủ công để đảm bảo ứng dụng không bị hỏng.
    return title
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

module.exports = { generateSlug };
