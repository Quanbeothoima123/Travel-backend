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

/**
 * Tạo excerpt/mô tả ngắn bằng AI
 * @param {string} context - Tiêu đề hoặc nội dung để tạo excerpt
 * @param {string} type - Loại content (news, guide, review, etc.)
 * @param {string} language - Ngôn ngữ (vi/en)
 * @returns {Promise<string>}
 */
async function generateExcerpt(context, type = "news", language = "vi") {
  if (!context) return "";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const typeNames = {
      vi: {
        news: "tin tức",
        guide: "hướng dẫn",
        review: "đánh giá",
        event: "sự kiện",
        promotion: "khuyến mãi",
      },
      en: {
        news: "news",
        guide: "guide",
        review: "review",
        event: "event",
        promotion: "promotion",
      },
    };

    const prompts = {
      vi: `Từ tiêu đề: "${context}", hãy viết một mô tả ngắn gọn (80-150 từ) cho bài ${
        typeNames.vi[type] || "tin tức"
      }.
      Yêu cầu:
      1. Ngôn ngữ tiếng Việt tự nhiên, dễ hiểu
      2. Thu hút người đọc
      3. Tóm tắt nội dung chính
      4. Không sử dụng từ ngữ quá phức tạp
      5. Chỉ trả về nội dung mô tả, không giải thích thêm`,

      en: `From the title: "${context}", write a brief description (80-150 words) for this ${
        typeNames.en[type] || "news"
      } article.
      Requirements:
      1. Natural, easy-to-understand English
      2. Engaging for readers
      3. Summarize main content
      4. Use simple language
      5. Return only the description content, no additional explanation`,
    };

    const result = await model.generateContent(prompts[language] || prompts.vi);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Lỗi khi tạo excerpt bằng AI:", error);
    return `Mô tả cho ${context}...`;
  }
}

/**
 * Tạo nội dung bài viết bằng AI
 * @param {string} context - Tiêu đề để tạo nội dung
 * @param {string} type - Loại content
 * @param {string} language - Ngôn ngữ
 * @returns {Promise<string>}
 */
async function generateContent(context, type = "news", language = "vi") {
  if (!context) return "";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompts = {
      vi: `Viết một bài ${
        type === "news" ? "tin tức" : type
      } hoàn chỉnh từ tiêu đề: "${context}".
      Yêu cầu:
      1. Nội dung từ 300-500 từ
      2. Cấu trúc rõ ràng với các đoạn văn
      3. Thông tin hữu ích và chính xác
      4. Ngôn ngữ tiếng Việt tự nhiên
      5. Định dạng HTML cơ bản (p, h3, strong, em)
      6. Chỉ trả về nội dung HTML, không giải thích`,

      en: `Write a complete ${type} article from the title: "${context}".
      Requirements:
      1. Content 300-500 words
      2. Clear structure with paragraphs
      3. Useful and accurate information
      4. Natural English
      5. Basic HTML formatting (p, h3, strong, em)
      6. Return only HTML content, no explanation`,
    };

    const result = await model.generateContent(prompts[language] || prompts.vi);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Lỗi khi tạo content bằng AI:", error);
    return `<p>Nội dung về ${context} sẽ được cập nhật sớm...</p>`;
  }
}

/**
 * Tạo meta title cho SEO
 * @param {string} context - Tiêu đề gốc
 * @param {string} type - Loại content
 * @param {string} language - Ngôn ngữ
 * @returns {Promise<string>}
 */
async function generateMetaTitle(context, type = "news", language = "vi") {
  if (!context) return "";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompts = {
      vi: `Từ tiêu đề: "${context}", tạo một meta title SEO (tối đa 60 ký tự).
      Yêu cầu:
      1. Tối đa 60 ký tự
      2. Hấp dẫn và tối ưu SEO
      3. Bao gồm từ khóa chính
      4. Phù hợp với ${type}
      5. Chỉ trả về meta title, không giải thích`,

      en: `From title: "${context}", create an SEO meta title (max 60 characters).
      Requirements:
      1. Maximum 60 characters
      2. Attractive and SEO optimized
      3. Include main keywords
      4. Suitable for ${type}
      5. Return only meta title, no explanation`,
    };

    const result = await model.generateContent(prompts[language] || prompts.vi);
    const response = await result.response;
    const metaTitle = response.text().trim();

    // Đảm bảo không vượt quá 60 ký tự
    return metaTitle.length > 60
      ? metaTitle.substring(0, 57) + "..."
      : metaTitle;
  } catch (error) {
    console.error("Lỗi khi tạo meta title bằng AI:", error);
    return context.length > 60 ? context.substring(0, 57) + "..." : context;
  }
}

/**
 * Tạo meta description cho SEO
 * @param {string} context - Tiêu đề hoặc nội dung
 * @param {string} type - Loại content
 * @param {string} language - Ngôn ngữ
 * @returns {Promise<string>}
 */
async function generateMetaDescription(
  context,
  type = "news",
  language = "vi"
) {
  if (!context) return "";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompts = {
      vi: `Từ tiêu đề: "${context}", tạo meta description SEO (tối đa 160 ký tự).
      Yêu cầu:
      1. Tối đa 160 ký tự
      2. Mô tả hấp dẫn, thu hút click
      3. Bao gồm từ khóa chính
      4. Phù hợp với loại ${type}
      5. Chỉ trả về meta description, không giải thích`,

      en: `From title: "${context}", create SEO meta description (max 160 characters).
      Requirements:
      1. Maximum 160 characters
      2. Attractive description that encourages clicks
      3. Include main keywords
      4. Suitable for ${type}
      5. Return only meta description, no explanation`,
    };

    const result = await model.generateContent(prompts[language] || prompts.vi);
    const response = await result.response;
    const metaDesc = response.text().trim();

    // Đảm bảo không vượt quá 160 ký tự
    return metaDesc.length > 160
      ? metaDesc.substring(0, 157) + "..."
      : metaDesc;
  } catch (error) {
    console.error("Lỗi khi tạo meta description bằng AI:", error);
    const fallback = `Tìm hiểu về ${context}`;
    return fallback.length > 160
      ? fallback.substring(0, 157) + "..."
      : fallback;
  }
}

/**
 * Tạo tags cho bài viết
 * @param {string} context - Tiêu đề hoặc nội dung
 * @param {string} type - Loại content
 * @param {string} language - Ngôn ngữ
 * @returns {Promise<Array<string>>}
 */
async function generateTags(context, type = "news", language = "vi") {
  if (!context) return [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompts = {
      vi: `Từ tiêu đề: "${context}", tạo 5-8 tags phù hợp cho bài ${type}.
      Yêu cầu:
      1. 5-8 tags ngắn gọn
      2. Liên quan đến nội dung chính
      3. Tối ưu SEO
      4. Mỗi tag 1-3 từ
      5. Trả về danh sách phân cách bởi dấu phẩy, không giải thích`,

      en: `From title: "${context}", create 5-8 suitable tags for this ${type}.
      Requirements:
      1. 5-8 concise tags
      2. Related to main content
      3. SEO optimized
      4. Each tag 1-3 words
      5. Return comma-separated list, no explanation`,
    };

    const result = await model.generateContent(prompts[language] || prompts.vi);
    const response = await result.response;
    const tagsText = response.text().trim();

    // Parse tags từ response
    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 8); // Giới hạn tối đa 8 tags

    return tags;
  } catch (error) {
    console.error("Lỗi khi tạo tags bằng AI:", error);
    return [context.split(" ").slice(0, 2).join(" ")]; // Fallback: lấy 2 từ đầu làm tag
  }
}

module.exports = {
  generateSlug,
  generateExcerpt,
  generateContent,
  generateMetaTitle,
  generateMetaDescription,
  generateTags,
};
