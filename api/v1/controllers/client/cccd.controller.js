// controllers/cccd.controller.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Prompt để trích xuất thông tin CCCD
const prompt_text = `
Bạn là trợ lý AI chuyên trích xuất thông tin từ CCCD Việt Nam.
Phân tích hình ảnh và trích xuất các thông tin sau, trả về dưới dạng JSON:

* ho_va_ten (Họ và tên)
* ngay_sinh (Ngày sinh, định dạng DD/MM/YYYY)
* gioi_tinh (Giới tính: Nam hoặc Nữ)
* noi_thuong_tru (Nơi thường trú/địa chỉ đầy đủ)

Lưu ý:
- Chỉ trả về JSON thuần túy, không có markdown, không có giải thích
- Nếu không tìm thấy thông tin nào, để giá trị là chuỗi rỗng ""
- Giới tính chỉ có 2 giá trị: "Nam" hoặc "Nữ"
`;

// Hàm chuyển file thành format Gemini
function fileToGenerativePart(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file tại: ${filePath}`);
  }

  const fileData = fs.readFileSync(filePath);
  const mimeType = "image/jpeg"; // Hỗ trợ cả PNG, JPG

  return {
    inlineData: {
      data: fileData.toString("base64"),
      mimeType,
    },
  };
}

// Controller: Xử lý upload và OCR CCCD
module.exports.extractCccdInfo = async (req, res) => {
  let imagePath = null;

  try {
    // Kiểm tra file upload
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: "Vui lòng tải lên ảnh CCCD",
      });
    }

    imagePath = req.file.path;
    console.log(`Đang xử lý CCCD: ${imagePath}`);

    // Gọi Gemini AI để OCR
    const imagePart = fileToGenerativePart(imagePath);
    const result = await model.generateContent([prompt_text, imagePart]);
    const response = result.response;
    let text = response.text();

    // Làm sạch JSON (loại bỏ markdown nếu có)
    text = text.replace(/```json\n?(.*?)\n?```/s, "$1").trim();

    // Parse JSON
    const cccdData = JSON.parse(text);

    // Chuẩn hóa dữ liệu
    const extractedData = {
      fullName: cccdData.ho_va_ten || "",
      birthDay: convertToISODate(cccdData.ngay_sinh) || "",
      sex: cccdData.gioi_tinh || "",
      address: cccdData.noi_thuong_tru || "",
    };

    return res.json({
      code: 200,
      message: "Trích xuất thông tin CCCD thành công",
      data: extractedData,
    });
  } catch (error) {
    console.error("Lỗi OCR CCCD:", error);
    return res.status(500).json({
      code: 500,
      message:
        "Không thể đọc thông tin từ ảnh CCCD. Vui lòng thử lại hoặc nhập thủ công.",
      error: error.message,
    });
  } finally {
    // XÓA FILE TẠM - RẤT QUAN TRỌNG CHO BẢO MẬT
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        console.log(`Đã xóa file tạm: ${imagePath}`);
      } catch (e) {
        console.error(`Không thể xóa file tạm: ${imagePath}`, e);
      }
    }
  }
};

// Helper: Chuyển đổi ngày sinh từ DD/MM/YYYY sang ISO format
function convertToISODate(dateStr) {
  if (!dateStr) return "";

  try {
    // Format: DD/MM/YYYY
    const parts = dateStr.split("/");
    if (parts.length !== 3) return "";

    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];

    // Trả về format YYYY-MM-DD cho input type="date"
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Lỗi chuyển đổi ngày:", error);
    return "";
  }
}
