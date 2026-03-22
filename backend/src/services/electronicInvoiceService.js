const crypto = require("crypto");
const { emitInvoiceViaPT } = require("./ptProvider");

/**
 * Simula el consumo de un Proveedor Tecnológico (PT) para FE en Colombia.
 * Recibe un pedido (con items/total) y retorna un mock de:
 * - CUFE: código único de factura electrónica
 * - URL_PDF: enlace al PDF generado
 * - JSON_DIAN: payload/acuse simulado que se guardará para auditoría
 */
async function processElectronicInvoice(order) {
  const provider = (process.env.INVOICE_PROVIDER || "mock").toLowerCase(); // mock | pt
  if (provider === "pt") {
    return emitInvoiceViaPT(order);
  }

  // En un PT real: aquí firmarías, enviarías XML/JSON, y recibirías CUFE/URL/acuse.
  const seed = `${order._id}:${order.numeroPedido}:${order.total}:${Date.now()}`;
  const CUFE = crypto.createHash("sha256").update(seed).digest("hex").toUpperCase();
  const URL_PDF = `https://pt.mock.local/invoices/${CUFE}.pdf`;

  const JSON_DIAN = {
    status: "ACEPTADA",
    cufe: CUFE,
    orderId: String(order._id),
    numeroPedido: order.numeroPedido,
    generatedAt: new Date().toISOString()
  };

  return { CUFE, URL_PDF, JSON_DIAN };
}

module.exports = { processElectronicInvoice };
