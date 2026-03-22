const XLSX = require("xlsx");
const Product = require("../models/Product");
const { uploadImageBuffer, deleteByPublicId } = require("../services/cloudinary");

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseNumber(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(`Campo '${fieldName}' debe ser numérico.`);
  return num;
}

/**
 * POST /api/products/bulk
 * Recibe un Excel (multipart/form-data, field: "file") y crea productos masivamente.
 *
 * Reglas:
 * - Valida columnas requeridas.
 * - Valida SKUs duplicados dentro del archivo.
 * - Valida que el SKU no exista ya en BD (para no pisar inventario existente).
 * - Inserta todo en una sola operación (all-or-nothing).
 */
async function bulkUploadProducts(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Archivo requerido (field: file)." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ message: "El Excel no tiene hojas." });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows.length) {
      return res.status(400).json({ message: "El Excel está vacío." });
    }

    // Soporta headers en español o igual que el schema.
    const required = [
      { key: "sku", aliases: ["sku"] },
      { key: "nombre", aliases: ["nombre", "name"] },
      { key: "precio", aliases: ["precio", "price"] },
      { key: "stock", aliases: ["stock"] },
      { key: "iva", aliases: ["iva"] },
      { key: "unidadMedida", aliases: ["unidadmedida", "unidad", "unidad_medida", "unit"] }
    ];

    const optional = [{ key: "proveedor", aliases: ["proveedor", "supplier", "vendor"] }];

    const productsToInsert = [];
    const seenSkus = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Map flexible headers -> canonical keys
      const normalizedRow = {};
      for (const [k, v] of Object.entries(row)) normalizedRow[normalizeHeader(k)] = v;

      const extracted = {};
      for (const field of required) {
        const alias = field.aliases.find((a) => normalizedRow[normalizeHeader(a)] !== undefined);
        extracted[field.key] = alias ? normalizedRow[normalizeHeader(alias)] : undefined;
      }
      for (const field of optional) {
        const alias = field.aliases.find((a) => normalizedRow[normalizeHeader(a)] !== undefined);
        extracted[field.key] = alias ? normalizedRow[normalizeHeader(alias)] : undefined;
      }

      const sku = String(extracted.sku || "").trim();
      if (!sku) return res.status(400).json({ message: `Fila ${i + 2}: sku requerido.` });
      if (seenSkus.has(sku)) {
        return res.status(409).json({ message: `SKU duplicado en el archivo: ${sku}` });
      }
      seenSkus.add(sku);

      const nombre = String(extracted.nombre || "").trim();
      if (!nombre) return res.status(400).json({ message: `Fila ${i + 2}: nombre requerido.` });

      const precio = parseNumber(extracted.precio, "precio");
      const stock = parseNumber(extracted.stock, "stock");
      const iva = parseNumber(extracted.iva, "iva");

      const unidadMedida = String(extracted.unidadMedida || "").trim();
      if (!unidadMedida) {
        return res.status(400).json({ message: `Fila ${i + 2}: unidadMedida requerida.` });
      }

      const proveedor = extracted.proveedor ? String(extracted.proveedor).trim() : "";
      productsToInsert.push({ sku, nombre, precio, stock, iva, unidadMedida, proveedor });
    }

    const skus = productsToInsert.map((p) => p.sku);
    const existing = await Product.find({ sku: { $in: skus } }, { sku: 1, _id: 0 }).lean();
    if (existing.length) {
      return res.status(409).json({
        message: "Hay SKUs que ya existen en la base de datos.",
        existingSkus: existing.map((e) => e.sku)
      });
    }

    const inserted = await Product.insertMany(productsToInsert, { ordered: true });
    return res.status(201).json({ insertedCount: inserted.length });
  } catch (err) {
    return res.status(500).json({ message: "Error procesando Excel.", error: err.message });
  }
}

/**
 * GET /api/products
 * Catálogo simple (público).
 */
async function listProducts(_req, res) {
  try {
    const items = await Product.find({})
      .sort({ createdAt: -1 })
      .select("sku nombre precio stock iva unidadMedida imageUrl proveedor")
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar el catálogo.", error: err.message });
  }
}

/**
 * GET /api/products/low-stock
 * Admin: devuelve productos con stock <= threshold (default 5).
 */
async function lowStock(req, res) {
  try {
    const threshold = Number(req.query?.threshold ?? 5);
    if (!Number.isFinite(threshold) || threshold < 0) return res.status(400).json({ message: "threshold inválido." });

    const items = await Product.find({ stock: { $lte: threshold } })
      .sort({ stock: 1, nombre: 1 })
      .select("sku nombre stock proveedor precio iva unidadMedida imageUrl")
      .lean();
    return res.json({ threshold, items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar sugerencia.", error: err.message });
  }
}

/**
 * POST /api/products/:id/image
 * Sube una imagen (multipart/form-data, field: "image") a Cloudinary y la asocia al producto.
 */
async function uploadProductImage(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Imagen requerida (field: image)." });
    }
    if (req.file.mimetype && !String(req.file.mimetype).startsWith("image/")) {
      return res.status(415).json({ message: "Solo se permiten imágenes." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Producto no encontrado." });

    const publicId = `product-${product._id.toString()}`;

    const result = await uploadImageBuffer({ buffer: req.file.buffer, publicId });

    const prevPublicId = product.imagePublicId;
    product.imageUrl = result.secure_url || result.url || "";
    product.imagePublicId = result.public_id || publicId;
    await product.save();

    if (prevPublicId && prevPublicId !== product.imagePublicId) {
      await deleteByPublicId(prevPublicId);
    }

    return res.json({
      product: {
        _id: product._id,
        sku: product.sku,
        nombre: product.nombre,
        precio: product.precio,
        stock: product.stock,
        iva: product.iva,
        unidadMedida: product.unidadMedida,
        imageUrl: product.imageUrl
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo subir la imagen.", error: err.message });
  }
}

module.exports = { bulkUploadProducts, listProducts, lowStock, uploadProductImage };
