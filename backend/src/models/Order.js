const mongoose = require("mongoose");
const Counter = require("./Counter");

const ORDER_STATUSES = ["Pendiente", "En Bodega", "Despachado", "Facturado", "Cancelado"];
const ORDER_SOURCES = ["Vendedor", "Cliente", "Marketplace"];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    cantidad: { type: Number, required: true, min: 1 },

    // Snapshot para rentabilidad histórica
    sku: { type: String, default: "" },
    nombre: { type: String, default: "" },
    precioUnit: { type: Number, default: 0 },
    iva: { type: Number, default: 0 },
    costoUnit: { type: Number, default: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    numeroPedido: { type: Number, unique: true, index: true },
    source: { type: String, enum: ORDER_SOURCES, default: "Vendedor", index: true },
    vendedorId: { type: mongoose.Schema.Types.ObjectId, index: true },
    // Cliente final (rol Cliente / User)
    customerId: { type: mongoose.Schema.Types.ObjectId, index: true },
    // Cliente comercial (cartera) asociado a un vendedor (Customer)
    customerRefId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    // Marketplace (público): datos de comprador
    marketplaceCustomer: {
      nombre: { type: String, default: "" },
      documento: { type: String, default: "" },
      telefono: { type: String, default: "" },
      email: { type: String, default: "" },
      direccion: { type: String, default: "" }
    },
    wantsInvoice: { type: Boolean, default: false },
    invoiceData: {
      nit: { type: String, default: "" },
      dv: { type: String, default: "" },
      razonSocial: { type: String, default: "" },
      nombreComercial: { type: String, default: "" },
      direccion: { type: String, default: "" },
      ciudad: { type: String, default: "" },
      departamento: { type: String, default: "" },
      pais: { type: String, default: "" },
      telefono: { type: String, default: "" },
      email: { type: String, default: "" },
      regimen: { type: String, default: "" },
      responsabilidades: { type: [String], default: [] }
    },
    rutUrl: { type: String, default: "" },
    rutPublicId: { type: String, default: "" },
    deliveryMethod: { type: String, enum: ["RecogeEnBodega", "Domicilio"], default: "RecogeEnBodega", index: true },
    deliveryAddress: { type: String, default: "" },
    paymentProofUrl: { type: String, default: "" },
    paymentProofPublicId: { type: String, default: "" },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ORDER_STATUSES, default: "Pendiente", index: true }
  },
  { timestamps: true }
);

orderSchema.path("vendedorId").validate(function validateVendedorId(value) {
  if (this.source !== "Vendedor") return true;
  return value != null;
}, "vendedorId requerido para pedidos de Vendedor.");

orderSchema.path("customerId").validate(function validateCustomerId(value) {
  if (this.source !== "Cliente") return true;
  return value != null;
}, "customerId requerido para pedidos de Cliente.");

// Autoincremental con colección Counter.
orderSchema.pre("save", async function preSave(next) {
  if (!this.isNew || this.numeroPedido != null) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { name: "order.numeroPedido" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.numeroPedido = counter.seq;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = {
  Order: mongoose.model("Order", orderSchema),
  ORDER_STATUSES,
  ORDER_SOURCES
};
