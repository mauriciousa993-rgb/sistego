const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");
const { logAction } = require("../services/audit");

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

async function listPayments(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ message: "Cliente no encontrado." });

    if (role === "Vendedor" && String(customer.vendedorId) !== String(userId)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const items = await Payment.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar pagos.", error: err.message });
  }
}

async function createPayment(req, res) {
  const session = await mongoose.startSession();
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "amount debe ser > 0." });
    const note = req.body?.note ? String(req.body.note).trim() : "";

    let created = null;
    let updatedCustomer = null;

    await session.withTransaction(async () => {
      const customer = await Customer.findById(req.params.id).session(session);
      if (!customer) {
        const e = new Error("Cliente no encontrado.");
        e.statusCode = 404;
        throw e;
      }

      if (role === "Vendedor" && String(customer.vendedorId) !== String(userId)) {
        const e = new Error("No autorizado.");
        e.statusCode = 403;
        throw e;
      }

      const vendedorId = role === "Admin" ? toObjectId(customer.vendedorId) : toObjectId(userId);
      if (!vendedorId) {
        const e = new Error("vendedorId inválido.");
        e.statusCode = 400;
        throw e;
      }

      created = await Payment.create(
        [
          {
            customerId: customer._id,
            vendedorId,
            amount,
            note
          }
        ],
        { session }
      );

      const nextSaldo = Number(customer.saldo || 0) - amount;
      customer.saldo = Math.round(Math.max(0, nextSaldo) * 100) / 100;
      await customer.save({ session });
      updatedCustomer = customer.toObject();
    });

    await logAction(req, {
      action: "customer.payment",
      entity: "Customer",
      entityId: String(req.params.id),
      meta: { amount }
    });
    return res.status(201).json({ payment: created?.[0] || null, customer: updatedCustomer });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || "No se pudo registrar pago.", error: err.message });
  } finally {
    session.endSession();
  }
}

module.exports = { listPayments, createPayment };
