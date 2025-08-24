const generateInvoiceCode = () => {
  return "QQ-" + Date.now();
};
module.exports = generateInvoiceCode;
