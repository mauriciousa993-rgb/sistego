const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const { User } = require("../models/User");

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function parseDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

async function salesSummary(req, res) {
  try {
    const from = parseDate(req.query?.from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDate(req.query?.to, new Date());

    const pipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      { $unwind: "$order.items" },
      {
        $lookup: {
          from: "products",
          localField: "order.items.product",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          qty: "$order.items.cantidad",
          unitPrice: { $ifNull: ["$order.items.precioUnit", "$product.precio"] },
          iva: { $ifNull: ["$order.items.iva", "$product.iva"] },
          unitCost: { $ifNull: ["$order.items.costoUnit", "$product.costo"] }
        }
      },
      {
        $addFields: {
          revenue: { $multiply: ["$unitPrice", "$qty", { $add: [1, { $divide: ["$iva", 100] }] }] },
          cost: { $multiply: ["$unitCost", "$qty"] }
        }
      },
      {
        $group: {
          _id: "$_id",
          orderTotal: { $first: "$order.total" },
          revenue: { $sum: "$revenue" },
          cost: { $sum: "$cost" }
        }
      },
      {
        $group: {
          _id: null,
          invoices: { $sum: 1 },
          totalSales: { $sum: "$orderTotal" },
          totalCost: { $sum: "$cost" }
        }
      }
    ];

    const rows = await Invoice.aggregate(pipeline);
    const row = rows[0] || { invoices: 0, totalSales: 0, totalCost: 0 };
    const totalSales = Math.round((row.totalSales || 0) * 100) / 100;
    const totalCost = Math.round((row.totalCost || 0) * 100) / 100;
    const grossProfit = Math.round((totalSales - totalCost) * 100) / 100;
    const margin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 1000) / 10 : 0;
    return res.json({ from, to, invoices: row.invoices, totalSales, totalCost, grossProfit, margin });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar resumen.", error: err.message });
  }
}

async function salesByVendor(req, res) {
  try {
    const from = parseDate(req.query?.from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDate(req.query?.to, new Date());

    const pipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      { $unwind: "$order.items" },
      {
        $lookup: {
          from: "products",
          localField: "order.items.product",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          qty: "$order.items.cantidad",
          unitPrice: { $ifNull: ["$order.items.precioUnit", "$product.precio"] },
          iva: { $ifNull: ["$order.items.iva", "$product.iva"] },
          unitCost: { $ifNull: ["$order.items.costoUnit", "$product.costo"] }
        }
      },
      {
        $addFields: {
          revenue: { $multiply: ["$unitPrice", "$qty", { $add: [1, { $divide: ["$iva", 100] }] }] },
          cost: { $multiply: ["$unitCost", "$qty"] }
        }
      },
      {
        $group: {
          _id: "$order.vendedorId",
          invoices: { $sum: 1 },
          totalSales: { $sum: "$revenue" },
          totalCost: { $sum: "$cost" }
        }
      },
      { $sort: { totalSales: -1 } }
    ];

    const rows = await Invoice.aggregate(pipeline);
    const vendorIds = rows.map((r) => toObjectId(r._id)).filter(Boolean);
    const users = await User.find({ _id: { $in: vendorIds } }).select("email nombre role").lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const items = rows.map((r) => {
      const u = userById.get(String(r._id));
      const sales = Math.round((r.totalSales || 0) * 100) / 100;
      const cost = Math.round((r.totalCost || 0) * 100) / 100;
      const profit = Math.round((sales - cost) * 100) / 100;
      const margin = sales > 0 ? Math.round((profit / sales) * 1000) / 10 : 0;
      return {
        vendedorId: String(r._id),
        vendedor: u ? { email: u.email, nombre: u.nombre || "" } : null,
        invoices: r.invoices,
        totalSales: sales,
        totalCost: cost,
        grossProfit: profit,
        margin
      };
    });

    return res.json({ from, to, items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar reporte.", error: err.message });
  }
}

async function profitByProduct(req, res) {
  try {
    const from = parseDate(req.query?.from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDate(req.query?.to, new Date());

    const pipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      { $unwind: "$order.items" },
      {
        $lookup: {
          from: "products",
          localField: "order.items.product",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          qty: "$order.items.cantidad",
          unitPrice: { $ifNull: ["$order.items.precioUnit", "$product.precio"] },
          iva: { $ifNull: ["$order.items.iva", "$product.iva"] },
          unitCost: { $ifNull: ["$order.items.costoUnit", "$product.costo"] },
          sku: { $ifNull: ["$order.items.sku", "$product.sku"] },
          nombre: { $ifNull: ["$order.items.nombre", "$product.nombre"] }
        }
      },
      {
        $addFields: {
          revenue: { $multiply: ["$unitPrice", "$qty", { $add: [1, { $divide: ["$iva", 100] }] }] },
          cost: { $multiply: ["$unitCost", "$qty"] }
        }
      },
      {
        $group: {
          _id: "$order.items.product",
          sku: { $first: "$sku" },
          nombre: { $first: "$nombre" },
          qty: { $sum: "$qty" },
          totalSales: { $sum: "$revenue" },
          totalCost: { $sum: "$cost" }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 200 }
    ];

    const rows = await Invoice.aggregate(pipeline);
    const items = rows.map((r) => {
      const sales = Math.round((r.totalSales || 0) * 100) / 100;
      const cost = Math.round((r.totalCost || 0) * 100) / 100;
      const profit = Math.round((sales - cost) * 100) / 100;
      const margin = sales > 0 ? Math.round((profit / sales) * 1000) / 10 : 0;
      return {
        productId: String(r._id),
        sku: r.sku || "",
        nombre: r.nombre || "",
        qty: r.qty || 0,
        totalSales: sales,
        totalCost: cost,
        grossProfit: profit,
        margin
      };
    });

    return res.json({ from, to, items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar rentabilidad.", error: err.message });
  }
}

module.exports = { salesSummary, salesByVendor, profitByProduct };
