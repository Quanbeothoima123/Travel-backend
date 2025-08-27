function createSlug(input) {
  let str = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  str = str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  return `${str}-${timestamp}`;
}

module.exports = createSlug;
