// controllers/admin/ai.controller.js
const {
  generateSlug,
  generateExcerpt,
  generateContent,
  generateMetaTitle,
  generateMetaDescription,
  generateTags,
} = require("../../../../services/slugService"); // Sử dụng path của bạn

/**
 * Generate slug
 */
module.exports.generateSlug = async (req, res) => {
  try {
    const { context, type, language } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context",
      });
    }

    const result = await generateSlug(context);

    console.log(`AI Generate slug:`, {
      context: context.substring(0, 50) + "...",
      resultLength: result.length,
    });

    res.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error("AI Generate Slug Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo slug: " + error.message,
    });
  }
};

/**
 * Generate excerpt
 */
module.exports.generateExcerpt = async (req, res) => {
  try {
    const { context, type, language } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context",
      });
    }

    const result = await generateExcerpt(context, type, language);

    res.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error("AI Generate Excerpt Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo excerpt: " + error.message,
    });
  }
};

/**
 * Generate content
 */
module.exports.generateContent = async (req, res) => {
  try {
    const { context, type, language } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context",
      });
    }

    const result = await generateContent(context, type, language);

    res.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error("AI Generate Content Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo content: " + error.message,
    });
  }
};

/**
 * Generate meta title
 */
module.exports.generateMetaTitle = async (req, res) => {
  try {
    const { context, type, language } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context",
      });
    }

    const result = await generateMetaTitle(context, type, language);

    res.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error("AI Generate Meta Title Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo meta title: " + error.message,
    });
  }
};

/**
 * Generate meta description
 */
module.exports.generateMetaDescription = async (req, res) => {
  try {
    const { context, type, language } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context",
      });
    }

    const result = await generateMetaDescription(context, type, language);

    res.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error("AI Generate Meta Description Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo meta description: " + error.message,
    });
  }
};

/**
 * Generate tags
 */
module.exports.generateTags = async (req, res) => {
  try {
    const { context, type, language } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context",
      });
    }

    const result = await generateTags(context, type, language);

    res.json({
      success: true,
      content: result,
    });
  } catch (error) {
    console.error("AI Generate Tags Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo tags: " + error.message,
    });
  }
};
