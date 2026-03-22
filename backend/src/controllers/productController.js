const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const Product = require("../models/Product");
const { uploadImageBuffer, deleteByPublicId } = require("../services/cloudinary");
const { logAction } = require("../services/audit");

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

function buildProductFilter(query) {
  const filter = {};
  const q = query || {};

  const like = (value) => ({ $regex: String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });

  // No listar desactivados por defecto
  filter.active = { $ne: false };

  if (q.codigo) filter.sku = like(q.codigo);
  if (q.descripcion) {
    filter.$or = [{ nombre: like(q.descripcion) }, { descripcion: like(q.descripcion) }];
  }
  if (q.categoria) filter.categoria = String(q.categoria).trim();
  if (q.subCategoria) filter.subCategoria = String(q.subCategoria).trim();
  if (q.referencia) filter.referencia = like(q.referencia);
  if (q.codigoBarras) filter.codigoBarras = like(q.codigoBarras);
  if (q.proveedor) filter.proveedor = like(q.proveedor);

  return filter;
}

function parseCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const sample = lines[0];
  const comma = (sample.match(/,/g) || []).length;
  const semi = (sample.match(/;/g) || []).length;
  const delimiter = semi > comma ? ";" : ",";

  function splitLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  const headers = splitLine(lines[0]).map((h) => normalizeHeader(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = cols[j] ?? "";
    rows.push(obj);
  }
  return rows;
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

    const isCsv =
      String(req.file.originalname || "").toLowerCase().endsWith(".csv") ||
      String(req.file.mimetype || "").includes("csv") ||
      String(req.file.mimetype || "").includes("text/plain");

    const rows = isCsv
      ? parseCsv(req.file.buffer)
      : (() => {
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) throw new Error("El Excel no tiene hojas.");
          const sheet = workbook.Sheets[firstSheetName];
          return XLSX.utils.sheet_to_json(sheet, { defval: "" });
        })();

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

    const optional = [
      { key: "costo", aliases: ["costo", "cost", "costoUnit", "costo_unit"] },
      { key: "proveedor", aliases: ["proveedor", "supplier", "vendor"] },
      { key: "descripcion", aliases: ["descripcion", "description"] },
      { key: "categoria", aliases: ["categoria", "category"] },
      { key: "subCategoria", aliases: ["subcategoria", "subcategoria", "subcategory", "sub_category"] },
      { key: "referencia", aliases: ["referencia", "ref"] },
      { key: "codigoBarras", aliases: ["codigobarras", "codigo_barras", "barcode", "ean"] }
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
      const descripcion = extracted.descripcion ? String(extracted.descripcion).trim() : "";
      const categoria = extracted.categoria ? String(extracted.categoria).trim() : "";
      const subCategoria = extracted.subCategoria ? String(extracted.subCategoria).trim() : "";
      const referencia = extracted.referencia ? String(extracted.referencia).trim() : "";
      const codigoBarras = extracted.codigoBarras ? String(extracted.codigoBarras).trim() : "";
      const costo = extracted.costo !== undefined && extracted.costo !== "" ? parseNumber(extracted.costo, "costo") : 0;

      productsToInsert.push({
        sku,
        nombre,
        descripcion,
        categoria,
        subCategoria,
        referencia,
        codigoBarras,
        costo,
        precio,
        stock,
        iva,
        unidadMedida,
        proveedor
      });
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
    await logAction(req, { action: "product.bulk", entity: "Product", entityId: "", meta: { insertedCount: inserted.length } });
    return res.status(201).json({ insertedCount: inserted.length });
  } catch (err) {
    return res.status(500).json({ message: "Error procesando Excel.", error: err.message });
  }
}

/**
 * GET /api/products
 * Catálogo simple (público).
 */
async function listProducts(req, res) {
  try {
    const filter = buildProductFilter(req.query);
    const items = await Product.find(filter)
      .sort({ createdAt: -1 })
      .select(
        "active sku nombre descripcion categoria subCategoria referencia codigoBarras costo precio stock iva unidadMedida imageUrl proveedor"
      )
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar el catálogo.", error: err.message });
  }
}

/**
 * GET /api/products/meta
 * Devuelve listas para combos (categoría/subcategoría y códigos barras).
 */
async function productsMeta(_req, res) {
  try {
    const categories = (await Product.distinct("categoria")).filter(Boolean).sort();
    const subCategories = (await Product.distinct("subCategoria")).filter(Boolean).sort();
    const barcodes = (await Product.distinct("codigoBarras")).filter(Boolean).sort();
    return res.json({ categories, subCategories, barcodes });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar meta.", error: err.message });
  }
}

/**
 * POST /api/products
 * Admin: crea un producto (manual).
 */
async function createProduct(req, res) {
  try {
    const body = req.body || {};
    const sku = String(body.sku || body.codigo || "").trim();
    const nombre = String(body.nombre || "").trim();
    if (!sku || !nombre) return res.status(400).json({ message: "sku/codigo y nombre son requeridos." });

    const exists = await Product.findOne({ sku }).lean();
    if (exists) return res.status(409).json({ message: "Ya existe un producto con ese código (sku)." });

    const product = await Product.create({
      active: true,
      sku,
      nombre,
      descripcion: body.descripcion ? String(body.descripcion).trim() : "",
      categoria: body.categoria ? String(body.categoria).trim() : "",
      subCategoria: body.subCategoria ? String(body.subCategoria).trim() : "",
      referencia: body.referencia ? String(body.referencia).trim() : "",
      codigoBarras: body.codigoBarras ? String(body.codigoBarras).trim() : "",
      costo: body.costo != null ? parseNumber(body.costo, "costo") : 0,
      precio: parseNumber(body.precio, "precio"),
      stock: parseNumber(body.stock, "stock"),
      iva: parseNumber(body.iva, "iva"),
      unidadMedida: String(body.unidadMedida || "").trim(),
      proveedor: body.proveedor ? String(body.proveedor).trim() : ""
    });

    await logAction(req, { action: "product.create", entity: "Product", entityId: product._id });
    return res.status(201).json({ product });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo crear producto.", error: err.message });
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

    const items = await Product.find({ active: { $ne: false }, stock: { $lte: threshold } })
      .sort({ stock: 1, nombre: 1 })
      .select("sku nombre stock proveedor precio iva unidadMedida imageUrl")
      .lean();
    return res.json({ threshold, items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar sugerencia.", error: err.message });
  }
}

/**
 * GET /api/products/export.xlsx
 * Admin: exporta inventario a Excel.
 */
async function exportProductsXlsx(_req, res) {
  try {
    const items = await Product.find({ active: { $ne: false } })
      .sort({ nombre: 1 })
      .select("sku nombre proveedor costo precio stock iva unidadMedida imageUrl")
      .lean();

    const rows = items.map((p) => ({
      sku: p.sku,
      nombre: p.nombre,
      proveedor: p.proveedor || "",
      costo: p.costo ?? 0,
      precio: p.precio,
      stock: p.stock,
      iva: p.iva,
      unidadMedida: p.unidadMedida,
      imageUrl: p.imageUrl || ""
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="inventario.xlsx"');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ message: "No se pudo exportar.", error: err.message });
  }
}

/**
 * GET /api/products/catalog.pdf
 * Genera un PDF simple del catálogo (con filtros opcionales por query).
 */
async function catalogPdf(req, res) {
  try {
    const filter = buildProductFilter(req.query);
    const items = await Product.find(filter)
      .sort({ categoria: 1, subCategoria: 1, nombre: 1 })
      .select("sku nombre descripcion categoria subCategoria referencia codigoBarras precio stock iva unidadMedida")
      .lean();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="catalogo.pdf"');

    const doc = new PDFDocument({ size: "A4", margin: 42 });
    doc.pipe(res);

    doc.fontSize(18).text("Catálogo de productos", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#555").text(`Generado: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1);
    doc.fillColor("#000");

    let y = doc.y;
    const rowH = 16;

    function header() {
      doc.fontSize(10).fillColor("#111");
      doc.text("Código", 42, y, { width: 70 });
      doc.text("Descripción", 112, y, { width: 220 });
      doc.text("Cat/Sub", 332, y, { width: 120 });
      doc.text("Precio", 452, y, { width: 60, align: "right" });
      doc.text("Stock", 512, y, { width: 40, align: "right" });
      y += rowH;
      doc.moveTo(42, y).lineTo(552, y).strokeColor("#ddd").stroke();
      y += 6;
      doc.strokeColor("#000");
    }

    header();

    doc.fontSize(9).fillColor("#222");
    for (const p of items) {
      if (y > 760) {
        doc.addPage();
        y = 42;
        header();
      }
      const cat = [p.categoria, p.subCategoria].filter(Boolean).join(" / ");
      doc.text(String(p.sku || ""), 42, y, { width: 70 });
      doc.text(String(p.descripcion || p.nombre || ""), 112, y, { width: 220 });
      doc.text(cat, 332, y, { width: 120 });
      doc.text(String(p.precio ?? ""), 452, y, { width: 60, align: "right" });
      doc.text(String(p.stock ?? ""), 512, y, { width: 40, align: "right" });
      y += rowH;
    }

    doc.end();
  } catch (err) {
    return res.status(500).json({ message: "No se pudo generar PDF.", error: err.message });
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

    await logAction(req, { action: "product.image", entity: "Product", entityId: product._id });
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

/**
 * PATCH /api/products/:id/stock
 * Bodega/Admin: ajusta stock del producto.
 */
async function updateStock(req, res) {
  try {
    const stock = Number(req.body?.stock);
    if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ message: "stock inválido." });

    const product = await Product.findById(req.params.id);
    if (!product || product.active === false) return res.status(404).json({ message: "Producto no encontrado." });

    const prev = product.stock;
    product.stock = stock;
    await product.save();
    await logAction(req, {
      action: "product.stock.update",
      entity: "Product",
      entityId: product._id,
      meta: { prev, stock }
    });
    return res.json({ product: product.toObject() });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo actualizar stock.", error: err.message });
  }
}

/**
 * DELETE /api/products/:id
 * Bodega/Admin: desactiva (borrado lógico) el producto.
 */
async function deactivate(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.active === false) return res.status(404).json({ message: "Producto no encontrado." });

    product.active = false;
    await product.save();
    await logAction(req, { action: "product.deactivate", entity: "Product", entityId: product._id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo desactivar producto.", error: err.message });
  }
}

module.exports = {
  bulkUploadProducts,
  listProducts,
  productsMeta,
  createProduct,
  lowStock,
  exportProductsXlsx,
  catalogPdf,
  updateStock,
  deactivate,
  uploadProductImage
};
