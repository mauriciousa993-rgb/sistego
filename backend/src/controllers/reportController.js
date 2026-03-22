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
      {
        $group: {
          _id: null,
          invoices: { $sum: 1 },
          totalSales: { $sum: "$order.total" }
        }
      }
    ];

    const rows = await Invoice.aggregate(pipeline);
    const row = rows[0] || { invoices: 0, totalSales: 0 };
    return res.json({ from, to, invoices: row.invoices, totalSales: Math.round(row.totalSales * 100) / 100 });
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
      {
        $group: {
          _id: "$order.vendedorId",
          invoices: { $sum: 1 },
          totalSales: { $sum: "$order.total" }
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
      return {
        vendedorId: String(r._id),
        vendedor: u ? { email: u.email, nombre: u.nombre || "" } : null,
        invoices: r.invoices,
        totalSales: Math.round((r.totalSales || 0) * 100) / 100
      };
    });

    return res.json({ from, to, items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar reporte.", error: err.message });
  }
}

module.exports = { salesSummary, salesByVendor };
