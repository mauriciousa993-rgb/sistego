const mongoose = require("mongoose");

const PO_STATUSES = ["Pendiente", "Recibido", "Cancelado"];

const poItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    cantidad: { type: Number, required: true, min: 1 },
    costoUnit: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    proveedor: { type: String, required: true, trim: true, index: true },
    items: { type: [poItemSchema], required: true },
    estado: { type: String, enum: PO_STATUSES, default: "Pendiente", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }
  },
  { timestamps: true }
);

module.exports = {
  PurchaseOrder: mongoose.model("PurchaseOrder", purchaseOrderSchema),
  PO_STATUSES
};
