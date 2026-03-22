const express = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
const { listAudit } = require("../controllers/auditController");

const router = express.Router();

router.get("/", authenticate, requireRole("Admin"), listAudit);

module.exports = router;
