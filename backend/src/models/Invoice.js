const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    CUFE: { type: String, required: true, index: true },
    URL_PDF: { type: String, required: true },
    JSON_DIAN: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);

