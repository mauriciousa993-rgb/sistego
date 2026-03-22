const mongoose = require("mongoose");
const { Order } = require("../models/Order");
const Invoice = require("../models/Invoice");
const { processElectronicInvoice } = require("../services/electronicInvoiceService");
const { User } = require("../models/User");
const { logAction } = require("../services/audit");

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

async function listInvoices(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const match = {};
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" }
    ];

    if (role === "Vendedor") {
      pipeline.push({ $match: { "order.vendedorId": toObjectId(userId) } });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $project: {
          CUFE: 1,
          URL_PDF: 1,
          createdAt: 1,
          orderId: 1,
          order: { _id: 1, numeroPedido: 1, total: 1, estado: 1, vendedorId: 1 }
        }
      },
      { $limit: 200 }
    );

    const items = await Invoice.aggregate(pipeline);

    if (role === "Admin") {
      const vendorIds = [...new Set(items.map((x) => String(x.order?.vendedorId)).filter(Boolean))].map(toObjectId);
      const users = await User.find({ _id: { $in: vendorIds } }).select("email nombre role").lean();
      const userById = new Map(users.map((u) => [String(u._id), u]));
      for (const inv of items) {
        const u = userById.get(String(inv.order?.vendedorId));
        if (u) inv.vendedor = { id: String(u._id), email: u.email, nombre: u.nombre || "" };
      }
    }

    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar facturas.", error: err.message });
  }
}

async function getInvoice(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "id inválido." });

    const pipeline = [
      { $match: { _id: id } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" }
    ];

    if (role === "Vendedor") pipeline.push({ $match: { "order.vendedorId": toObjectId(userId) } });

    pipeline.push({ $project: { CUFE: 1, URL_PDF: 1, JSON_DIAN: 1, createdAt: 1, orderId: 1, order: 1 } });

    const items = await Invoice.aggregate(pipeline);
    const invoice = items[0];
    if (!invoice) return res.status(404).json({ message: "Factura no encontrada." });
    return res.json({ invoice });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar factura.", error: err.message });
  }
}

/**
 * POST /api/invoices/:orderId/emit
 * Solo para Admin (aquí no se implementa auth; se recomienda JWT + roles).
 *
 * Regla:
 * - Solo permite facturar pedidos "Despachado".
 * - Genera CUFE/URL_PDF/JSON_DIAN (mock) y guarda Invoice.
 * - Cambia el estado del pedido a "Facturado" (transaccional).
 */
async function emitElectronicInvoice(req, res) {
  const { orderId } = req.params;
  const session = await mongoose.startSession();

  try {
    let createdInvoice = null;

    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        const e = new Error("Pedido no encontrado.");
        e.statusCode = 404;
        throw e;
      }
      if (order.estado !== "Despachado") {
        const e = new Error(`Estado inválido para facturar: ${order.estado}`);
        e.statusCode = 409;
        throw e;
      }

      const existing = await Invoice.findOne({ orderId: order._id }).session(session).lean();
      if (existing) {
        const e = new Error("Este pedido ya tiene factura.");
        e.statusCode = 409;
        throw e;
      }

      const ptResponse = await processElectronicInvoice(order.toObject());

      createdInvoice = await Invoice.create(
        [
          {
            orderId: order._id,
            CUFE: ptResponse.CUFE,
            URL_PDF: ptResponse.URL_PDF,
            JSON_DIAN: ptResponse.JSON_DIAN
          }
        ],
        { session }
      );

      order.estado = "Facturado";
      await order.save({ session });
    });

    await logAction(req, { action: "invoice.emit", entity: "Invoice", entityId: String(orderId) });
    return res.status(201).json({ invoice: createdInvoice?.[0] || null });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || "Error emitiendo factura." });
  } finally {
    session.endSession();
  }
}

module.exports = { emitElectronicInvoice, listInvoices, getInvoice };
