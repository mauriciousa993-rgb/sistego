const mongoose = require("mongoose");
const Product = require("../models/Product");
const { Order } = require("../models/Order");
const { logAction } = require("../services/audit");

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function computeTotal(items, productsById) {
  let total = 0;
  for (const it of items) {
    const p = productsById.get(String(it.product));
    if (!p) continue;
    const precio = Number(p.precio) || 0;
    const iva = Number(p.iva) || 0;
    const cantidad = Number(it.cantidad) || 0;
    const line = precio * cantidad * (1 + iva / 100);
    total += line;
  }
  return Math.round(total * 100) / 100;
}

/**
 * POST /api/orders
 * Crea pedido (Vendedor).
 */
async function createOrder(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "No autenticado." });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: "items es requerido." });

    const normalizedItems = items.map((it) => ({
      product: toObjectId(it.product),
      cantidad: Number(it.cantidad)
    }));

    if (normalizedItems.some((it) => !it.product || !Number.isFinite(it.cantidad) || it.cantidad < 1)) {
      return res.status(400).json({ message: "items inválidos (product, cantidad>=1)." });
    }

    const productIds = normalizedItems.map((it) => it.product);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("precio iva")
      .lean();
    const productsById = new Map(products.map((p) => [String(p._id), p]));
    if (productsById.size !== productIds.length) {
      return res.status(400).json({ message: "Uno o más productos no existen." });
    }

    const total = computeTotal(normalizedItems, productsById);
    const order = await Order.create({
      source: "Vendedor",
      vendedorId: toObjectId(userId),
      items: normalizedItems,
      total,
      estado: "Pendiente"
    });

    await logAction(req, { action: "order.create", entity: "Order", entityId: order._id, meta: { total, items: items.length } });
    return res.status(201).json({ order });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo crear pedido.", error: err.message });
  }
}

/**
 * GET /api/orders
 * Vendedor: sus pedidos; Admin/Bodega: todos.
 */
async function listOrders(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const filter = {};
    if (role === "Vendedor") {
      filter.source = "Vendedor";
      filter.vendedorId = toObjectId(userId);
    }
    if (req.query?.estado) filter.estado = String(req.query.estado);
    if (req.query?.source && role !== "Vendedor") filter.source = String(req.query.source);

    const items = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "items.product", select: "sku nombre precio iva unidadMedida imageUrl" })
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar pedidos.", error: err.message });
  }
}

/**
 * GET /api/orders/:id
 */
async function getOrder(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const order = await Order.findById(req.params.id)
      .populate({ path: "items.product", select: "sku nombre precio iva unidadMedida imageUrl stock" })
      .lean();
    if (!order) return res.status(404).json({ message: "Pedido no encontrado." });

    if (role === "Vendedor" && (order.source !== "Vendedor" || String(order.vendedorId) !== String(userId))) {
      return res.status(403).json({ message: "No autorizado." });
    }

    return res.json({ order });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar pedido.", error: err.message });
  }
}

/**
 * PATCH /api/orders/:id/approve
 * Admin: mueve pedido Pendiente -> En Bodega
 */
async function approveOrder(req, res) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Pedido no encontrado." });
    if (order.estado !== "Pendiente") {
      return res.status(409).json({ message: `Estado inválido para aprobar: ${order.estado}` });
    }

    order.estado = "En Bodega";
    await order.save();
    await logAction(req, { action: "order.approve", entity: "Order", entityId: order._id });
    return res.json({ order: order.toObject() });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo aprobar pedido.", error: err.message });
  }
}

/**
 * PATCH /api/orders/:id/cancel
 * Admin: cancela pedido Pendiente/En Bodega
 */
async function cancelOrder(req, res) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Pedido no encontrado." });
    if (!["Pendiente", "En Bodega"].includes(order.estado)) {
      return res.status(409).json({ message: `Estado inválido para cancelar: ${order.estado}` });
    }
    order.estado = "Cancelado";
    await order.save();
    await logAction(req, { action: "order.cancel", entity: "Order", entityId: order._id });
    return res.json({ order: order.toObject() });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cancelar pedido.", error: err.message });
  }
}

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

      if (!["En Bodega"].includes(order.estado)) {
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

    await logAction(req, { action: "order.dispatch", entity: "Order", entityId: id });
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

module.exports = { createOrder, listOrders, getOrder, approveOrder, cancelOrder, dispatchOrder };
