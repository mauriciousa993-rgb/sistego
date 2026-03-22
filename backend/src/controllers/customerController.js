const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const { logAction } = require("../services/audit");

function toObjectId(value) {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

async function listCustomers(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const filter = {};
    if (role === "Vendedor") filter.vendedorId = toObjectId(userId);

    const items = await Customer.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar clientes.", error: err.message });
  }
}

async function createCustomer(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const {
      nombre,
      documento,
      telefono,
      email,
      direccion,
      cupoCredito,
      saldo,
      vendedorId,
      nit,
      dv,
      razonSocial,
      nombreComercial,
      ciudad,
      departamento,
      pais,
      regimen,
      responsabilidades,
      rutUrl,
      rutPublicId
    } = req.body || {};
    if (!nombre) return res.status(400).json({ message: "nombre es requerido." });

    let assignedVendedorId = null;
    if (role === "Admin" && vendedorId) assignedVendedorId = toObjectId(vendedorId);
    else assignedVendedorId = toObjectId(userId);

    if (!assignedVendedorId) return res.status(400).json({ message: "vendedorId inválido." });

    const customer = await Customer.create({
      vendedorId: assignedVendedorId,
      nombre: String(nombre).trim(),
      documento: documento ? String(documento).trim() : undefined,
      telefono: telefono ? String(telefono).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      direccion: direccion ? String(direccion).trim() : undefined,
      nit: nit ? String(nit).trim() : undefined,
      dv: dv ? String(dv).trim() : undefined,
      razonSocial: razonSocial ? String(razonSocial).trim() : undefined,
      nombreComercial: nombreComercial ? String(nombreComercial).trim() : undefined,
      ciudad: ciudad ? String(ciudad).trim() : undefined,
      departamento: departamento ? String(departamento).trim() : undefined,
      pais: pais ? String(pais).trim() : undefined,
      regimen: regimen ? String(regimen).trim() : undefined,
      responsabilidades: Array.isArray(responsabilidades) ? responsabilidades.map((x) => String(x)) : undefined,
      rutUrl: rutUrl ? String(rutUrl) : undefined,
      rutPublicId: rutPublicId ? String(rutPublicId) : undefined,
      cupoCredito: cupoCredito != null ? Number(cupoCredito) : undefined,
      saldo: saldo != null ? Number(saldo) : undefined
    });

    await logAction(req, { action: "customer.create", entity: "Customer", entityId: customer._id });
    return res.status(201).json({ customer });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo crear cliente.", error: err.message });
  }
}

async function updateCustomer(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return res.status(401).json({ message: "No autenticado." });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Cliente no encontrado." });

    if (role === "Vendedor" && String(customer.vendedorId) !== String(userId)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const allowed = ["nombre", "documento", "telefono", "email", "direccion", "cupoCredito", "saldo"];
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) customer[key] = req.body[key];
    }
    await customer.save();
    await logAction(req, { action: "customer.update", entity: "Customer", entityId: customer._id });
    return res.json({ customer });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo actualizar cliente.", error: err.message });
  }
}

module.exports = { listCustomers, createCustomer, updateCustomer };
