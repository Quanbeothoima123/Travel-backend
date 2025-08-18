// helpers/buildTree.js
module.exports = function buildTree(categories) {
  const map = {};
  const roots = [];

  // Khởi tạo node có children
  categories.forEach((cat) => {
    map[cat._id] = { ...cat._doc, children: [] };
    // cat._doc nếu dùng mongoose, nếu bạn dùng lean() thì chỉ cần {...cat}
  });

  // Gắn node con vào node cha
  categories.forEach((cat) => {
    if (cat.parentId) {
      map[cat.parentId]?.children.push(map[cat._id]);
    } else {
      roots.push(map[cat._id]);
    }
  });

  return roots;
};
