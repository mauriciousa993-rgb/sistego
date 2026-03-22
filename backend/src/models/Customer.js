const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    vendedorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    nombre: { type: String, required: true, trim: true, index: true },
    documento: { type: String, trim: true, index: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    direccion: { type: String, trim: true },

    // Cartera / crédito (simple)
    cupoCredito: { type: Number, default: 0, min: 0 },
    saldo: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
