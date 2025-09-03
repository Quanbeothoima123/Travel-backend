const Tour = require("../../models/tour.model");
const jwt = require("jsonwebtoken");
module.exports.getTours = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const total = await Tour.countDocuments(query);

    const tours = await Tour.find(query)
      .populate("categoryId", "title slug")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.json({
      data: tours,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.bulkUpdateTours = async (req, res) => {
  try {
    const { ids, updateData } = req.body; // ids: [tourId1, tourId2,...]

    if (!ids || !updateData) {
      return res.status(400).json({ message: "Missing ids or updateData" });
    }

    await Tour.updateMany({ _id: { $in: ids } }, { $set: updateData });

    res.json({ message: `Đã cập nhật ${ids.length} sản phẩm` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports.updateTour = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Tour.findByIdAndUpdate(id, req.body, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy tour này!" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/v1/tours/create
 */
exports.createTour = async (req, res) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies.adminToken;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Không có token, vui lòng đăng nhập" });
    }

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET); // nhớ để secret trong .env
    } catch (err) {
      return res.status(403).json({ message: "Token không hợp lệ" });
    }

    // Dữ liệu body từ frontend
    const body = req.body;

    // Gán thêm createdBy
    const tourData = {
      ...body,
      createdBy: {
        _id: decoded.id,
        at: new Date(),
      },
    };

    // Tạo tour mới
    const newTour = new Tour(tourData);
    await newTour.save();

    return res.status(201).json({
      message: "Tạo tour thành công",
      tour: newTour,
    });
  } catch (err) {
    console.error("Lỗi khi tạo tour:", err);
    res.status(500).json({ message: "Server error" });
  }
};
