const mongoose = require("mongoose");
const Counter = require("./Counter");

const ORDER_STATUSES = ["Pendiente", "En Bodega", "Despachado", "Facturado", "Cancelado"];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    cantidad: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    numeroPedido: { type: Number, unique: true, index: true },
    vendedorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ORDER_STATUSES, default: "Pendiente", index: true }
  },
  { timestamps: true }
);

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
  ORDER_STATUSES
};
