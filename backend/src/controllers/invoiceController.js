const mongoose = require("mongoose");
const { Order } = require("../models/Order");
const Invoice = require("../models/Invoice");
const { processElectronicInvoice } = require("../services/electronicInvoiceService");

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

    return res.status(201).json({ invoice: createdInvoice?.[0] || null });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || "Error emitiendo factura." });
  } finally {
    session.endSession();
  }
}

module.exports = { emitElectronicInvoice };

