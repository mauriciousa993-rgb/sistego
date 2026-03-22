const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, index: true },
    role: { type: String, index: true },
    email: { type: String, index: true },

    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, default: "", index: true },
    meta: { type: mongoose.Schema.Types.Mixed },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
