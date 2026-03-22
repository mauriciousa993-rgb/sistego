const mongoose = require("mongoose");
const Product = require("../models/Product");
const { PurchaseOrder } = require("../models/PurchaseOrder");
const { logAction } = require("../services/audit");

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

async function listPurchaseOrders(_req, res) {
  try {
    const items = await PurchaseOrder.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "items.product", select: "sku nombre proveedor stock" })
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar órdenes de compra.", error: err.message });
  }
}

async function createPurchaseOrder(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "No autenticado." });

    const proveedor = String(req.body?.proveedor || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!proveedor) return res.status(400).json({ message: "proveedor es requerido." });
    if (!items.length) return res.status(400).json({ message: "items es requerido." });

    const normalized = items.map((it) => ({
      product: toObjectId(it.product),
      cantidad: Number(it.cantidad),
      costoUnit: it.costoUnit != null ? Number(it.costoUnit) : 0
    }));

    if (normalized.some((it) => !it.product || !Number.isFinite(it.cantidad) || it.cantidad < 1)) {
      return res.status(400).json({ message: "items inválidos (product, cantidad>=1)." });
    }

    const productIds = normalized.map((it) => it.product);
    const products = await Product.find({ _id: { $in: productIds } }).select("proveedor").lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    if (byId.size !== productIds.length) return res.status(400).json({ message: "Uno o más productos no existen." });

    // Validación opcional: si el producto tiene proveedor distinto, lo dejamos pero avisamos.
    const mismatch = [];
    for (const it of normalized) {
      const p = byId.get(String(it.product));
      if (p?.proveedor && String(p.proveedor).trim() && String(p.proveedor).trim() !== proveedor) {
        mismatch.push({ productId: String(it.product), proveedorProducto: p.proveedor });
      }
    }

    const po = await PurchaseOrder.create({
      proveedor,
      items: normalized,
      createdBy: toObjectId(userId),
      estado: "Pendiente"
    });

    await logAction(req, { action: "po.create", entity: "PurchaseOrder", entityId: po._id, meta: { proveedor, items: items.length } });
    return res.status(201).json({ purchaseOrder: po.toObject(), proveedorMismatch: mismatch });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo crear orden de compra.", error: err.message });
  }
}

async function receivePurchaseOrder(req, res) {
  const session = await mongoose.startSession();
  try {
    const poId = toObjectId(req.params.id);
    if (!poId) return res.status(400).json({ message: "id inválido." });

    let updated = null;
    await session.withTransaction(async () => {
      const po = await PurchaseOrder.findById(poId).session(session);
      if (!po) {
        const e = new Error("Orden de compra no encontrada.");
        e.statusCode = 404;
        throw e;
      }
      if (po.estado !== "Pendiente") {
        const e = new Error(`Estado inválido para recibir: ${po.estado}`);
        e.statusCode = 409;
        throw e;
      }

      const bulkOps = po.items.map((it) => ({
        updateOne: {
          filter: { _id: it.product },
          update: { $inc: { stock: it.cantidad } }
        }
      }));
      if (bulkOps.length) await Product.bulkWrite(bulkOps, { session });

      po.estado = "Recibido";
      await po.save({ session });
      updated = await PurchaseOrder.findById(po._id)
        .populate({ path: "items.product", select: "sku nombre proveedor stock" })
        .session(session)
        .lean();
    });

    await logAction(req, { action: "po.receive", entity: "PurchaseOrder", entityId: String(poId) });
    return res.json({ purchaseOrder: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || "No se pudo recibir.", error: err.message });
  } finally {
    session.endSession();
  }
}

module.exports = { listPurchaseOrders, createPurchaseOrder, receivePurchaseOrder };
