const mongoose = require("mongoose");
const Product = require("../models/Product");
const { Order } = require("../models/Order");

/**
 * PATCH /api/orders/:id/dispatch
 *
 * Lógica de inventario (clave):
 * - Primero validamos que cada producto tenga stock >= cantidad solicitada.
 * - Luego descontamos stock con actualizaciones atómicas (condición stock >= cantidad).
 *   Esto evita "stock negativo" si dos despachos ocurren al mismo tiempo.
 * - Finalmente marcamos el pedido como "Despachado".
 *
 * Se ejecuta en transacción para mantener consistencia entre Orden y Productos.
 */
async function dispatchOrder(req, res) {
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    let updatedOrder = null;

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session).lean();
      if (!order) {
        const e = new Error("Pedido no encontrado.");
        e.statusCode = 404;
        throw e;
      }

      if (!["Pendiente", "En Bodega"].includes(order.estado)) {
        const e = new Error(`Estado inválido para despacho: ${order.estado}`);
        e.statusCode = 409;
        throw e;
      }

      if (!Array.isArray(order.items) || order.items.length === 0) {
        const e = new Error("El pedido no tiene items.");
        e.statusCode = 400;
        throw e;
      }

      // Validación de stock previa (lectura)
      const productIds = order.items.map((it) => it.product);
      const products = await Product.find({ _id: { $in: productIds } }, { stock: 1 })
        .session(session)
        .lean();

      const stockById = new Map(products.map((p) => [String(p._id), p.stock]));
      const insufficient = [];

      for (const item of order.items) {
        const currentStock = stockById.get(String(item.product));
        if (currentStock == null) {
          insufficient.push({ productId: String(item.product), reason: "Producto no existe." });
          continue;
        }
        if (currentStock < item.cantidad) {
          insufficient.push({
            productId: String(item.product),
            requested: item.cantidad,
            available: currentStock
          });
        }
      }

      if (insufficient.length) {
        const e = new Error("Stock insuficiente para despachar el pedido.");
        e.statusCode = 400;
        e.details = insufficient;
        throw e;
      }

      // Descuento de inventario (atómico) por ítem:
      // condición: stock >= cantidad; update: stock -= cantidad
      const bulkOps = order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.product, stock: { $gte: item.cantidad } },
          update: { $inc: { stock: -item.cantidad } }
        }
      }));

      const bulkResult = await Product.bulkWrite(bulkOps, { session });
      const updatedCount = bulkResult.modifiedCount ?? bulkResult.nModified ?? 0;
      if (updatedCount !== order.items.length) {
        // Si alguien consumió stock entre la validación y el descuento, abortamos.
        const e = new Error("Conflicto de inventario. Reintenta el despacho.");
        e.statusCode = 409;
        throw e;
      }

      updatedOrder = await Order.findByIdAndUpdate(
        order._id,
        { $set: { estado: "Despachado" } },
        { new: true, session }
      ).lean();
    });

    return res.json({ order: updatedOrder });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      message: err.message || "Error despachando pedido.",
      details: err.details
    });
  } finally {
    session.endSession();
  }
}

module.exports = { dispatchOrder };

