const Invoice = require("../../models/invoice.model");
module.exports.getById = async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    const invoice = await Invoice.find({ _id: invoiceId });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
