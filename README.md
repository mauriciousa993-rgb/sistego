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

El healthcheck queda en `GET /health`.

### Frontend en Vercel (Vite + React)

En Vercel, importa el repo y configura:
- **Root Directory**: `frontend`
- **Environment Variable**: `VITE_API_URL` = `https://<tu-servicio>.onrender.com`

Con eso el frontend llamará al backend en Render tanto para `/health` como para `/api/*`.
