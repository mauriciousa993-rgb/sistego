# SISTEGO (MERN) - Base

Backend (Express + Mongoose) con:
- Inventario por `Product.stock` y despacho transaccional.
- Facturación electrónica mock con `CUFE`, `URL_PDF`, `JSON_DIAN`.
- JWT + roles (`Vendedor`, `Bodega`, `Admin`) y rutas protegidas.

Archivos clave:
- Modelos: `backend/src/models/*`
- Auth: `backend/src/controllers/authController.js`
- Bulk productos: `backend/src/controllers/productController.js`
- Despacho: `backend/src/controllers/orderController.js`
- Facturación: `backend/src/controllers/invoiceController.js`
- Config DIAN/PT: `backend/src/config/dian.js`

Variables de entorno:
- Copia `backend/.env.example` a `backend/.env` y ajusta valores.

## Levantar en local (pruebas)

Requisitos:
- Node.js 18+ (recomendado 20+)
- MongoDB local **o** Docker Desktop/Engine para levantar Mongo

### 1) MongoDB (con Docker)

Desde la raíz del repo:
```bash
docker compose up -d mongo
```

### 2) Backend (API)

```bash
cp backend/.env.example backend/.env
cd backend
npm install
npm start
```

Endpoints útiles:
- `GET /health` → healthcheck
- `POST /api/auth/register` → crear usuario (roles: `Vendedor`, `Bodega`, `Admin`)
- `POST /api/auth/login` → obtener JWT

Quick check:
```bash
curl http://localhost:4000/health
```

### 3) Frontend (UI mínima para pruebas)

En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

Luego abre `http://localhost:5173` (hace proxy a `http://localhost:4000`).

## Deploy (Render + Vercel)

Nota: **Mongo “local” solo aplica en tu máquina**. En Render/Vercel necesitas un Mongo accesible por internet (p.ej. MongoDB Atlas) y configurar `MONGO_URI` con esa URL.

### Backend en Render (API)

Opción recomendada: **Blueprint** usando `render.yaml` (en la raíz del repo).

Variables mínimas en Render:
- `MONGO_URI` (ej: Atlas)
- `JWT_SECRET` (fuerte, en prod)
- `OPENAI_API_KEY` (para leer RUT y autocompletar cliente)

El healthcheck queda en `GET /health`.

### Frontend en Vercel (Vite + React)

En Vercel, importa el repo y configura:
- **Root Directory**: `frontend`
- **Environment Variable**: `VITE_API_URL` = `https://<tu-servicio>.onrender.com`

Con eso el frontend llamará al backend en Render tanto para `/health` como para `/api/*`.

### Cloudinary (fotos de productos)

Backend expone:
- `GET /api/products` → catálogo público (incluye `imageUrl`)
- `POST /api/products/:id/image` → subir foto (requiere JWT con rol `Admin`, multipart field `image`)

Configura en el backend (Render o `backend/.env` en local):
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (opcional, default: `sistego/products`)

## UI (Login + Dashboard por rol)

La UI ya no expone registro público: la primera pantalla es **Login**.

Roles:
- `Vendedor`: crear pedidos, ver facturas, ver/crear clientes (cartera simple).
- `Bodega`: ver pedidos y despachar (descuenta inventario).
- `Admin`: reportes (ventas generales y por vendedor), inventario + fotos, crear usuarios.
- `Cliente`: ver productos disponibles, carrito, enviar pedido a bodega, ver sus pedidos/facturas.

## API agregada

Pedidos:
- `POST /api/orders` (Vendedor) crear pedido
- `GET /api/orders` (Auth) listar pedidos (Vendedor ve solo los suyos)

Clientes (cartera):
- `GET /api/customers` (Vendedor/Admin)
- `POST /api/customers` (Vendedor/Admin)
- `POST /api/customers/rut/parse` (Vendedor/Admin) subir RUT (PDF/imagen) y autocompletar datos con OpenAI

Facturas:
- `GET /api/invoices` (Vendedor/Admin)
- `POST /api/invoices/:orderId/emit` (Admin)

Reportes:
- `GET /api/reports/sales/summary` (Admin)
- `GET /api/reports/sales/by-vendor` (Admin)

Inventario:
- `GET /api/products/low-stock?threshold=5` (Admin) sugerencia de productos con bajo inventario (usa campo opcional `proveedor`).
- `GET /api/products/export.xlsx` (Admin) export inventario a Excel.
- `GET /api/products/meta` (Auth) categorías/subcategorías/barcodes para filtros.
- `GET /api/products?codigo=&descripcion=&categoria=&subCategoria=&referencia=&codigoBarras=` (público) búsqueda/filtrado.
- `GET /api/products/catalog.pdf` (Vendedor/Cliente/Admin) descarga de catálogo PDF (con query filters).
- `POST /api/products` (Admin) crear producto manual.
- `POST /api/products/bulk` (Admin) carga masiva Excel/CSV.
- `PATCH /api/products/:id/stock` (Bodega/Admin) ajustar stock manual.
- `DELETE /api/products/:id` (Bodega/Admin) desactivar (borrado lógico) producto.

Rentabilidad:
- En productos agrega `costo` (costo unitario) para calcular utilidad.
- Reportes (Admin) soportan `from` y `to` (YYYY-MM-DD):
  - `GET /api/reports/sales/summary?from=2026-01-01&to=2026-01-31` incluye `totalCost`, `grossProfit`, `margin`.
  - `GET /api/reports/profit/by-product?from=...&to=...` rentabilidad por producto.

Tienda (Cliente):
- `GET /api/shop/products` (Cliente) productos disponibles (stock > 0)
- `POST /api/shop/orders` (Cliente) crea pedido y entra directo a `En Bodega`
- `GET /api/shop/orders` (Cliente) lista sus pedidos

Compras:
- `POST /api/purchase-orders` (Admin) crear orden de compra por proveedor
- `GET /api/purchase-orders` (Admin) listar órdenes de compra
- `PATCH /api/purchase-orders/:id/receive` (Admin) recibir y aumentar stock

Pedidos (flujo):
- `PATCH /api/orders/:id/approve` (Admin) pasa de `Pendiente` a `En Bodega`
- `PATCH /api/orders/:id/dispatch` (Bodega) solo permite `En Bodega`
- `PATCH /api/orders/:id/cancel` (Admin) cancela `Pendiente/En Bodega`

Auditoría:
- `GET /api/audit` (Admin) últimos 200 eventos

## Registro (seguridad)

En producción se recomienda mantener `DISABLE_PUBLIC_REGISTER=true`.
Si necesitas crear el primer Admin:
- temporalmente pon `ALLOW_PUBLIC_REGISTER=true` (o `DISABLE_PUBLIC_REGISTER=false`) en el backend, crea el usuario, y vuelve a deshabilitarlo.
