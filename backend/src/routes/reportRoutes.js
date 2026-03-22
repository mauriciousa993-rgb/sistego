const express = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
const { salesSummary, salesByVendor } = require("../controllers/reportController");

const router = express.Router();

router.get("/sales/summary", authenticate, requireRole("Admin"), salesSummary);
router.get("/sales/by-vendor", authenticate, requireRole("Admin"), salesByVendor);

module.exports = router;
