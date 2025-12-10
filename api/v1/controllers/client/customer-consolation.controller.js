const jwt = require("jsonwebtoken");
const CustomerConsolation = require("../../models/customer-consolation.model");
const JWT_SECRET = process.env.JWT_SECRET;

// [POST] /api/v1/customer-consolation
module.exports.createCustomerConsolation = async (req, res) => {
  try {
    const { phoneNumber, tourId } = req.body;

    if (!phoneNumber) {
      return res.json({ code: 400, message: "Vui lòng nhập số điện thoại" });
    }
    const userId = req.user.userId;

    // Kiểm tra xem số điện thoại đã có chưa
    let record = await CustomerConsolation.findOne({ phoneNumber, tourId });

    if (record) {
      // nếu đã tồn tại thì tăng requestCount
      record.requestCount += 1;
      record.UpdateAt = new Date();
      await record.save();
    } else {
      // nếu chưa có thì tạo mới
      record = new CustomerConsolation({
        userId: userId || null,
        tourId: tourId || null,
        phoneNumber,
        requestCount: 1,
        consultedCount: 0,
        isBlacklisted: false,
        CreatedAt_first: new Date(),
        UpdateAt: new Date(),
      });
      await record.save();
    }

    return res.json({
      success: true,
      message: "Tạo yêu cầu tư vấn thành công",
      data: record,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
