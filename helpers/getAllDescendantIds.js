// helpers/getAllDescendantIds.js
const TourCategory = require("../api/v1/models/tour-category.model");

module.exports = async function getAllDescendantIds(rootId) {
  const queue = [rootId.toString()];
  const collected = new Set();

  while (queue.length) {
    const parentIdStr = queue.shift();
    const children = await TourCategory.find({ parentId: parentIdStr })
      .select("_id")
      .lean();
    for (const child of children) {
      const childIdStr = child._id.toString();
      if (!collected.has(childIdStr)) {
        collected.add(childIdStr);
        queue.push(childIdStr);
      }
    }
  }

  // Trả về mảng CHUỖI (string) để phù hợp với Tour.categoryId nếu đó là string
  return Array.from(collected);
};
