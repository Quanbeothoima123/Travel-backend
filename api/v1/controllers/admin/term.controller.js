const Term = require("../../models/term.model");
module.exports.getAll = async (req, res) => {
  try {
    const terms = await Term.find();
    res.status(200).json(terms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
