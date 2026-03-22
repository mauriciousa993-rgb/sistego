const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    vendedorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    amount: { type: Number, required: true },
    note: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
