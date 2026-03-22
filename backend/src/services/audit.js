const AuditLog = require("../models/AuditLog");

async function logAction(req, { action, entity, entityId = "", meta = null }) {
  try {
    const enabled = String(process.env.AUDIT_ENABLED || "true").toLowerCase() !== "false";
    if (!enabled) return;
    const user = req.user || {};
    await AuditLog.create({
      userId: user?.sub,
      role: user?.role || "",
      email: user?.email || "",
      action,
      entity,
      entityId: entityId ? String(entityId) : "",
      meta,
      ip: req.ip || "",
      userAgent: String(req.headers["user-agent"] || "")
    });
  } catch {
    // best-effort: no romper la request
  }
}

module.exports = { logAction };
