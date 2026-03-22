const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true, index: true },
    sku: { type: String, required: true, unique: true, index: true, trim: true },
    // Código / descripción
    nombre: { type: String, required: true, trim: true }, // nombre corto
    descripcion: { type: String, trim: true, default: "" },

    // Clasificación (para filtros/catálogos)
    categoria: { type: String, trim: true, index: true, default: "" },
    subCategoria: { type: String, trim: true, index: true, default: "" },
    referencia: { type: String, trim: true, index: true, default: "" },
    codigoBarras: { type: String, trim: true, index: true, default: "" },

    // Costeo (para rentabilidad)
    costo: { type: Number, default: 0, min: 0 },

    precio: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    // IVA en porcentaje (por ejemplo: 19 para 19%)
    iva: { type: Number, required: true, min: 0, max: 100 },
    unidadMedida: { type: String, required: true, trim: true },

    // Imagen del producto (Cloudinary)
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },

    // Proveedor (opcional, para sugerir compras por bajo inventario)
    proveedor: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
