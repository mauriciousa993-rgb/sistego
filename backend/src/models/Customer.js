const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    vendedorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    nombre: { type: String, required: true, trim: true, index: true },
    documento: { type: String, trim: true, index: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    direccion: { type: String, trim: true },

    // Datos FE (desde RUT)
    nit: { type: String, trim: true, index: true },
    dv: { type: String, trim: true },
    razonSocial: { type: String, trim: true },
    nombreComercial: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    departamento: { type: String, trim: true },
    pais: { type: String, trim: true },
    regimen: { type: String, trim: true },
    responsabilidades: { type: [String], default: [] },

    // Archivo RUT (Cloudinary)
    rutUrl: { type: String, default: "" },
    rutPublicId: { type: String, default: "" },

    // Cartera / crédito (simple)
    cupoCredito: { type: Number, default: 0, min: 0 },
    saldo: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
