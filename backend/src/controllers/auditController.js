const AuditLog = require("../models/AuditLog");

async function listAudit(req, res) {
  try {
    const items = await AuditLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo cargar auditoría.", error: err.message });
  }
}

module.exports = { listAudit };
