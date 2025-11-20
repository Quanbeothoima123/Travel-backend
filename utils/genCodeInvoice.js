const generateInvoiceCode = () => {
  const prefix = "CASH-";
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}${timestamp}${random}`;
};
module.exports = generateInvoiceCode;
