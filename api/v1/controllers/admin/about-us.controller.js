const AboutUs = require("../../models/about-us.model");

// GET - Lấy thông tin About Us (chỉ có 1 document duy nhất)
module.exports.get = async (req, res) => {
  try {
    const aboutUs = await AboutUs.findOne().lean();

    if (!aboutUs) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "Chưa có thông tin About Us",
      });
    }

    return res.status(200).json({
      success: true,
      data: aboutUs,
    });
  } catch (error) {
    console.error("Error fetching About Us:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin About Us",
      error: error.message,
    });
  }
};

// POST - Tạo hoặc cập nhật About Us
module.exports.createOrUpdate = async (req, res) => {
  try {
    const data = req.body;
    const adminId = req.user?._id; // Từ middleware auth

    // Kiểm tra xem đã có document chưa
    const existing = await AboutUs.findOne();

    if (existing) {
      // Cập nhật document hiện tại
      const updated = await AboutUs.findByIdAndUpdate(
        existing._id,
        {
          ...data,
          lastUpdatedBy: {
            _id: adminId,
            time: new Date(),
          },
        },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        success: true,
        data: updated,
        message: "Cập nhật thông tin About Us thành công",
      });
    } else {
      // Tạo mới
      const newAboutUs = new AboutUs({
        ...data,
        lastUpdatedBy: {
          _id: adminId,
          time: new Date(),
        },
      });

      await newAboutUs.save();

      return res.status(201).json({
        success: true,
        data: newAboutUs,
        message: "Tạo thông tin About Us thành công",
      });
    }
  } catch (error) {
    console.error("Error creating/updating About Us:", error);

    // Validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lưu thông tin About Us",
      error: error.message,
    });
  }
};

// DELETE - Xóa toàn bộ thông tin (cẩn thận!)
module.exports.delete = async (req, res) => {
  try {
    const aboutUs = await AboutUs.findOne();

    if (!aboutUs) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin About Us",
      });
    }

    await AboutUs.deleteOne({ _id: aboutUs._id });

    return res.status(200).json({
      success: true,
      message: "Đã xóa thông tin About Us",
    });
  } catch (error) {
    console.error("Error deleting About Us:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa thông tin About Us",
      error: error.message,
    });
  }
};

// PATCH - Toggle active status
module.exports.toggleActive = async (req, res) => {
  try {
    const aboutUs = await AboutUs.findOne();

    if (!aboutUs) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin About Us",
      });
    }

    aboutUs.isActive = !aboutUs.isActive;
    aboutUs.lastUpdatedBy = {
      _id: req.user?._id,
      time: new Date(),
    };

    await aboutUs.save();

    return res.status(200).json({
      success: true,
      data: aboutUs,
      message: `Đã ${aboutUs.isActive ? "kích hoạt" : "vô hiệu hóa"} About Us`,
    });
  } catch (error) {
    console.error("Error toggling About Us status:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi thay đổi trạng thái",
      error: error.message,
    });
  }
};
