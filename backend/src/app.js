const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const reportRoutes = require("./routes/reportRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const auditRoutes = require("./routes/auditRoutes");
const shopRoutes = require("./routes/shopRoutes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/purchase-orders", purchaseOrderRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/shop", shopRoutes);

  // Error handler básico
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // Multer / XLSX / etc.
    return res.status(500).json({ message: "Error inesperado.", error: err.message });
  });

  return app;
}

module.exports = { createApp };
