const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    // IVA en porcentaje (por ejemplo: 19 para 19%)
    iva: { type: Number, required: true, min: 0, max: 100 },
    unidadMedida: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

