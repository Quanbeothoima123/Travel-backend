// helpers/getAllDescendantIds.js
module.exports = async function getAllDescendantIds(
  Model,
  rootId,
  parentField = "parentId"
) {
  const queue = [rootId.toString()];
  const collected = new Set();

  while (queue.length) {
    const parentIdStr = queue.shift();

    // Tìm tất cả con của node hiện tại
    const children = await Model.find({ [parentField]: parentIdStr })
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

  return Array.from(collected);
};
