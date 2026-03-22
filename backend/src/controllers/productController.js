const XLSX = require("xlsx");
const Product = require("../models/Product");

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

      productsToInsert.push({ sku, nombre, precio, stock, iva, unidadMedida });
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

module.exports = { bulkUploadProducts };

