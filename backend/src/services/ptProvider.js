const { getDianConfig, validateDianConfig } = require("../config/dian");

/**
 * "Conector" (placeholder) para un Proveedor Tecnológico (PT).
 *
 * Aquí es donde integrarías el SDK/REST real del PT:
 * - autenticación (API key / OAuth)
 * - firma/certificado (si aplica)
 * - envío de documento y recepción de CUFE/acuse/URL_PDF
 *
 * Por ahora retorna error explícito para evitar "falsos positivos" en producción.
 */
async function emitInvoiceViaPT(_order) {
  const cfg = getDianConfig();
  validateDianConfig(cfg);

  // Si necesitas un modo "simulado pero pasando por la capa PT", activa PT_DRY_RUN=true
  if (String(process.env.PT_DRY_RUN || "").toLowerCase() === "true") {
    return {
      provider: "PT_DRY_RUN",
      CUFE: `DRYRUN-${Date.now()}`,
      URL_PDF: "https://pt.mock.local/invoices/DRYRUN.pdf",
      JSON_DIAN: { status: "DRY_RUN", note: "No se envió a PT real.", environment: cfg.environment }
    };
  }

  throw new Error(
    "Integración PT real no implementada. Configura PT_DRY_RUN=true o implementa emitInvoiceViaPT()."
  );
}

module.exports = { emitInvoiceViaPT };

