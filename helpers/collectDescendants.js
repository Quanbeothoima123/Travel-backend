function collectDescendants(id, categoryMap) {
  const toDelete = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    toDelete.add(cur);
    Object.values(categoryMap).forEach((c) => {
      if (
        c.parentId &&
        c.parentId.toString() === cur &&
        !toDelete.has(c._id.toString())
      ) {
        stack.push(c._id.toString());
      }
    });
  }
  return Array.from(toDelete);
}
module.exports = collectDescendants;
