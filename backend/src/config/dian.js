function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en variables de entorno.`);
  return v;
}

function optional(name, fallback = "") {
  return process.env[name] ?? fallback;
}

/**
 * Config base para DIAN / Proveedor Tecnológico (PT).
 *
 * Nota: La DIAN exige parámetros como NIT, SoftwareID, PIN/clave técnica, TestSetId (en habilitación),
 * y certificados/llaves para firma. Aquí solo dejamos un "contrato" de configuración (sin hardcode).
 */
function getDianConfig() {
  const environment = optional("DIAN_ENV", "HABILITACION"); // HABILITACION | PRODUCCION

  const cfg = {
    environment,
    nit: required("DIAN_NIT"),
    dv: optional("DIAN_DV"),
    softwareId: required("DIAN_SOFTWARE_ID"),
    softwarePin: required("DIAN_SOFTWARE_PIN"),
    technicalKey: optional("DIAN_TECHNICAL_KEY"),
    testSetId: optional("DIAN_TEST_SET_ID"),
    issuerName: optional("DIAN_ISSUER_NAME"),

    // Firma (paths o base64) - depende de tu implementación/SDK PT.
    certificateBase64: optional("DIAN_CERT_BASE64"),
    certificatePassword: optional("DIAN_CERT_PASSWORD"),

    // Endpoints (cuando conectes PT real).
    ptApiBaseUrl: optional("PT_API_BASE_URL"),
    ptApiKey: optional("PT_API_KEY")
  };

  return cfg;
}

function validateDianConfig(cfg) {
  if (!["HABILITACION", "PRODUCCION"].includes(cfg.environment)) {
    throw new Error("DIAN_ENV debe ser HABILITACION o PRODUCCION.");
  }
  if (!/^\d+$/.test(cfg.nit)) throw new Error("DIAN_NIT debe ser numérico.");

  // Recomendaciones mínimas (no bloqueantes) para habilitación:
  // - En habilitación normalmente se requiere DIAN_TEST_SET_ID.
  // - Para firma real se requiere certificado + password.
  return true;
}

module.exports = { getDianConfig, validateDianConfig };

