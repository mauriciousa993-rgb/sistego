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

function toDetailedItems(items, productsById) {
  return items.map((it) => {
    const p = productsById.get(String(it.product));
    const precioUnit = Number(p?.precio) || 0;
    const iva = Number(p?.iva) || 0;
    const costoUnit = Number(p?.costo) || 0;
    return {
      product: it.product,
      cantidad: it.cantidad,
      sku: String(p?.sku || ""),
      nombre: String(p?.nombre || ""),
      precioUnit,
      iva,
      costoUnit
    };
  });
}

// Catálogo para cliente final: solo disponibles (stock > 0)
async function listShopProducts(_req, res) {
  try {
    const items = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } })
      .sort({ nombre: 1 })
      .select("sku nombre precio stock iva unidadMedida imageUrl proveedor")
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar productos.", error: err.message });
  }
}

// Cliente crea pedido y entra directo a bodega
async function createShopOrder(req, res) {
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
      .select("sku nombre precio iva costo stock")
      .lean();
    const productsById = new Map(products.map((p) => [String(p._id), p]));
    if (productsById.size !== productIds.length) return res.status(400).json({ message: "Uno o más productos no existen." });

    // Validar disponibilidad
    const insufficient = [];
    for (const it of normalizedItems) {
      const p = productsById.get(String(it.product));
      if ((p?.stock ?? 0) < it.cantidad) insufficient.push({ productId: String(it.product), available: p?.stock ?? 0, requested: it.cantidad });
    }
    if (insufficient.length) return res.status(400).json({ message: "Stock insuficiente.", details: insufficient });

    const detailedItems = toDetailedItems(normalizedItems, productsById);
    const total = computeTotal(normalizedItems, productsById);
    const order = await Order.create({
      source: "Cliente",
      customerId: toObjectId(userId),
      items: detailedItems,
      total,
      estado: "En Bodega"
    });

    await logAction(req, { action: "shop.order.create", entity: "Order", entityId: order._id, meta: { total, items: items.length } });
    return res.status(201).json({ order });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo crear pedido.", error: err.message });
  }
}

async function listMyShopOrders(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "No autenticado." });

    const items = await Order.find({ source: "Cliente", customerId: toObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "items.product", select: "sku nombre precio iva unidadMedida imageUrl" })
      .lean();

    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar pedidos.", error: err.message });
  }
}

module.exports = { listShopProducts, createShopOrder, listMyShopOrders };
