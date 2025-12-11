// Import thư viện Google Generative AI
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Tạo tag tự động bằng Google Gemini API.
 * @param {string} title - Tiêu đề của bài viết hoặc nội dung cần tạo tag.
 * @returns {Promise<string[]>} - Một mảng các tag.
 */
async function generateTagsAI(title) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Tinh chỉnh prompt để yêu cầu Gemini trả về JSON một cách nhất quán
    // Việc đưa ra ví dụ (few-shot prompting) giúp AI hiểu rõ yêu cầu hơn
    const prompt = `Từ tiêu đề về du lịch sau: "${title}", hãy tạo ra một danh sách gồm 8 tag phù hợp nhất,nếu title không đủ kí tự thì có thể trả ra danh sách ít hơn.
    Yêu cầu quan trọng: Chỉ trả về một mảng JSON hợp lệ chứa các chuỗi (string).
    Ví dụ: ["du lịch đà nẵng", "cầu rồng", "bãi biển mỹ khê", "ẩm thực miền trung", "sơn trà"]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    try {
      // Dọn dẹp text một chút để đảm bảo nó là JSON hợp lệ, loại bỏ các ký tự không cần thiết
      const cleanedText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const tags = JSON.parse(cleanedText);
      // Đảm bảo kết quả trả về là một mảng
      return Array.isArray(tags) ? tags : [];
    } catch (e) {
      // Nếu parse JSON thất bại, xử lý nó như một chuỗi bình thường
      console.warn(
        "Phản hồi từ Gemini không phải là JSON hợp lệ, đang xử lý dưới dạng chuỗi..."
      );
      return text
        .split(/,|\n/)
        .map((t) => t.replace(/["\[\]]/g, "").trim())
        .filter((t) => t);
    }
  } catch (error) {
    console.error("Đã xảy ra lỗi khi gọi Gemini API:", error);
    return []; // Trả về mảng rỗng nếu có lỗi để tránh làm hỏng ứng dụng
  }
}

module.exports = { generateTagsAI };
