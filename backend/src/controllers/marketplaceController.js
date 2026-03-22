const mongoose = require("mongoose");
const Product = require("../models/Product");
const { Order } = require("../models/Order");
const { logAction } = require("../services/audit");
const { parseRut } = require("../services/rutParser");
const { uploadImageBuffer, uploadRawBuffer } = require("../services/cloudinary");

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
    total += precio * cantidad * (1 + iva / 100);
  }
  return Math.round(total * 100) / 100;
}

function toDetailedItems(items, productsById) {
  return items.map((it) => {
    const p = productsById.get(String(it.product));
    return {
      product: it.product,
      cantidad: it.cantidad,
      sku: String(p?.sku || ""),
      nombre: String(p?.nombre || ""),
      precioUnit: Number(p?.precio) || 0,
      iva: Number(p?.iva) || 0,
      costoUnit: Number(p?.costo) || 0
    };
  });
}

async function listPublicProducts(_req, res) {
  try {
    const items = await Product.find({ active: { $ne: false }, stock: { $gt: 0 } })
      .sort({ categoria: 1, subCategoria: 1, nombre: 1 })
      .select("sku nombre descripcion categoria subCategoria referencia codigoBarras precio stock iva unidadMedida imageUrl proveedor")
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar catálogo.", error: err.message });
  }
}

async function publicMeta(_req, res) {
  try {
    const categories = (await Product.distinct("categoria", { active: { $ne: false } })).filter(Boolean).sort();
    const subCategories = (await Product.distinct("subCategoria", { active: { $ne: false } })).filter(Boolean).sort();
    return res.json({ categories, subCategories });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar meta.", error: err.message });
  }
}

async function createPublicOrder(req, res) {
  try {
    const wantsInvoice = String(req.body?.wantsInvoice || "").toLowerCase() === "true";
    const deliveryMethod = String(req.body?.deliveryMethod || "RecogeEnBodega");
    const deliveryAddress = String(req.body?.deliveryAddress || "").trim();

    if (!["RecogeEnBodega", "Domicilio"].includes(deliveryMethod)) {
      return res.status(400).json({ message: "deliveryMethod inválido." });
    }
    if (deliveryMethod === "Domicilio" && !deliveryAddress) {
      return res.status(400).json({ message: "deliveryAddress es requerido para domicilio." });
    }

    const nombre = String(req.body?.nombre || "").trim();
    const documento = String(req.body?.documento || "").trim();
    const telefono = String(req.body?.telefono || "").trim();
    const email = String(req.body?.email || "").trim();
    const direccion = String(req.body?.direccion || "").trim();

    if (!nombre) return res.status(400).json({ message: "nombre es requerido." });
    if (!telefono && !email) return res.status(400).json({ message: "telefono o email es requerido." });

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(String(req.body?.items || "[]"));
    } catch {
      return res.status(400).json({ message: "items inválido (JSON requerido)." });
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) return res.status(400).json({ message: "items es requerido." });

    const normalizedItems = parsedItems.map((it) => ({
      product: toObjectId(it.product),
      cantidad: Number(it.cantidad)
    }));
    if (normalizedItems.some((it) => !it.product || !Number.isFinite(it.cantidad) || it.cantidad < 1)) {
      return res.status(400).json({ message: "items inválidos (product, cantidad>=1)." });
    }

    // Cargar productos
    const productIds = normalizedItems.map((it) => it.product);
    const products = await Product.find({ _id: { $in: productIds }, active: { $ne: false } })
      .select("sku nombre precio iva costo stock")
      .lean();
    const productsById = new Map(products.map((p) => [String(p._id), p]));
    if (productsById.size !== productIds.length) return res.status(400).json({ message: "Uno o más productos no existen o están inactivos." });

    const insufficient = [];
    for (const it of normalizedItems) {
      const p = productsById.get(String(it.product));
      if ((p?.stock ?? 0) < it.cantidad) insufficient.push({ productId: String(it.product), available: p?.stock ?? 0, requested: it.cantidad });
    }
    if (insufficient.length) return res.status(400).json({ message: "Stock insuficiente.", details: insufficient });

    // RUT + datos de factura
    let invoiceData = null;
    let rutUrl = "";
    let rutPublicId = "";

    if (wantsInvoice) {
      const rutFile = req.files?.rut?.[0] || null;
      if (!rutFile?.buffer) return res.status(400).json({ message: "RUT requerido para factura electrónica (field: rut)." });
      const extracted = await parseRut({ buffer: rutFile.buffer, mimetype: rutFile.mimetype, filename: rutFile.originalname });
      invoiceData = extracted;

      try {
        const uploaded = await uploadRawBuffer({
          buffer: rutFile.buffer,
          publicId: `market-rut-${Date.now()}`,
          filename: rutFile.originalname,
          contentType: rutFile.mimetype,
          folder: process.env.CLOUDINARY_FOLDER_RUT || "sistego/rut"
        });
        rutUrl = uploaded?.secure_url || uploaded?.url || "";
        rutPublicId = uploaded?.public_id || "";
      } catch {
        // Best-effort
      }
    }

    // Comprobante de pago (opcional)
    let paymentProofUrl = "";
    let paymentProofPublicId = "";
    const paymentFile = req.files?.paymentProof?.[0] || null;
    if (paymentFile?.buffer) {
      const isPdf = String(paymentFile.mimetype || "").toLowerCase().includes("pdf") || String(paymentFile.originalname || "").toLowerCase().endsWith(".pdf");
      try {
        const uploaded = isPdf
          ? await uploadRawBuffer({
              buffer: paymentFile.buffer,
              publicId: `payment-${Date.now()}`,
              filename: paymentFile.originalname,
              contentType: paymentFile.mimetype,
              folder: process.env.CLOUDINARY_FOLDER_PAYMENTS || "sistego/payments"
            })
          : await uploadImageBuffer({
              buffer: paymentFile.buffer,
              publicId: `payment-${Date.now()}`,
              folder: process.env.CLOUDINARY_FOLDER_PAYMENTS || "sistego/payments"
            });
        paymentProofUrl = uploaded?.secure_url || uploaded?.url || "";
        paymentProofPublicId = uploaded?.public_id || "";
      } catch {
        // Best-effort
      }
    }

    const detailedItems = toDetailedItems(normalizedItems, productsById);
    const total = computeTotal(normalizedItems, productsById);

    const order = await Order.create({
      source: "Marketplace",
      estado: "En Bodega",
      items: detailedItems,
      total,
      marketplaceCustomer: { nombre, documento, telefono, email, direccion },
      wantsInvoice,
      invoiceData: invoiceData || undefined,
      rutUrl,
      rutPublicId,
      deliveryMethod,
      deliveryAddress: deliveryMethod === "Domicilio" ? deliveryAddress : "",
      paymentProofUrl,
      paymentProofPublicId
    });

    await logAction(req, {
      action: "marketplace.order.create",
      entity: "Order",
      entityId: order._id,
      meta: { total, items: normalizedItems.length, deliveryMethod, wantsInvoice }
    });

    return res.status(201).json({ order: { id: String(order._id), numeroPedido: order.numeroPedido, estado: order.estado } });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo crear pedido.", error: err.message });
  }
}

module.exports = { listPublicProducts, publicMeta, createPublicOrder };

