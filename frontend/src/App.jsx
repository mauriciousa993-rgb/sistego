import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api.js";

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return safeJsonParse(json, null);
  } catch {
    return null;
  }
}

function getStoredAuth() {
  const token = localStorage.getItem("token") || "";
  const storedUser = safeJsonParse(localStorage.getItem("user") || "null", null);
  const payload = token ? decodeJwt(token) : null;
  const user = storedUser || (payload ? { id: payload.sub, email: payload.email, role: payload.role } : null);
  return { token, user };
}

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default function App() {
  const [health, setHealth] = useState({ loading: true, ok: false, error: "" });
  const [auth, setAuth] = useState(() => {
    const { token, user } = getStoredAuth();
    return { token, user, loading: false, error: "" };
  });

  const role = auth.user?.role || "";
  const isAdmin = role === "Admin";
  const isVendor = role === "Vendedor";
  const isBodega = role === "Bodega";

  const [active, setActive] = useState("home");

  const nav = useMemo(() => {
    if (!role) return [];
    if (role === "Vendedor") return ["home", "orders", "customers", "invoices"];
    if (role === "Bodega") return ["home", "orders"];
    return ["home", "reports", "inventory", "invoices", "users"];
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setHealth({ loading: true, ok: false, error: "" });
        const { data } = await api.get("/health");
        if (!cancelled) setHealth({ loading: false, ok: Boolean(data?.ok), error: "" });
      } catch (err) {
        if (!cancelled) setHealth({ loading: false, ok: false, error: err?.message || String(err) });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistAuth({ token, user }) {
    const nextToken = String(token || "");
    if (nextToken) localStorage.setItem("token", nextToken);
    else localStorage.removeItem("token");

    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");

    setAuth((s) => ({ ...s, token: nextToken, user: user || null }));
  }

  async function onLogin(e) {
    e.preventDefault();
    try {
      setAuth((s) => ({ ...s, loading: true, error: "" }));
      const form = new FormData(e.currentTarget);
      const email = String(form.get("email") || "");
      const password = String(form.get("password") || "");
      const { data } = await api.post("/api/auth/login", { email, password });
      persistAuth({ token: data?.token || "", user: data?.user || null });
      setActive("home");
      setAuth((s) => ({ ...s, loading: false, error: "" }));
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo iniciar sesión.";
      setAuth((s) => ({ ...s, loading: false, error: message }));
    }
  }

  function logout() {
    persistAuth({ token: "", user: null });
    setActive("home");
  }

  if (!auth.token) {
    return (
      <div className="authPage">
        <div className="authCard">
          <div className="authBrand">
            <div className="brandDot" />
            <div>
              <div className="brandTitle">SISTEGO</div>
              <div className="brandSub">Acceso al sistema</div>
            </div>
          </div>

          <form onSubmit={onLogin} className="stack">
            <input className="input" name="email" placeholder="Email" autoComplete="email" />
            <input
              className="input"
              name="password"
              type="password"
              placeholder="Contraseña"
              autoComplete="current-password"
            />
            <button className="btn primary" disabled={auth.loading} type="submit">
              {auth.loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {auth.error ? <p className="bad">ERROR: {auth.error}</p> : null}
          <p className="muted" style={{ marginTop: 12 }}>
            API: <code>{import.meta?.env?.VITE_API_URL || "(mismo origen)"}</code> · Health:{" "}
            {health.loading ? "verificando…" : health.ok ? <span className="ok">OK</span> : <span className="bad">ERROR</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashPage">
      <aside className="side">
        <div className="sideHeader">
          <div className="brandDot" />
          <div>
            <div className="brandTitle">SISTEGO</div>
            <div className="brandSub">
              {auth.user?.email} · <strong>{role}</strong>
            </div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((key) => (
            <button
              key={key}
              className={`navItem ${active === key ? "active" : ""}`}
              type="button"
              onClick={() => setActive(key)}
            >
              {key === "home" ? "Inicio" : null}
              {key === "orders" ? "Pedidos" : null}
              {key === "customers" ? "Clientes" : null}
              {key === "invoices" ? "Facturas" : null}
              {key === "inventory" ? "Inventario" : null}
              {key === "reports" ? "Reportes" : null}
              {key === "users" ? "Usuarios" : null}
            </button>
          ))}
        </nav>

        <div className="sideFooter">
          <button className="btn" type="button" onClick={logout}>
            Salir
          </button>
          <div className="muted" style={{ marginTop: 8 }}>
            Health:{" "}
            {health.loading ? "…" : health.ok ? <span className="ok">OK</span> : <span className="bad">ERROR</span>}
          </div>
        </div>
      </aside>

      <main className="main">
        {active === "home" ? <HomePanel role={role} /> : null}
        {active === "orders" ? <OrdersPanel role={role} /> : null}
        {active === "customers" && isVendor ? <CustomersPanel /> : null}
        {active === "customers" && isAdmin ? <CustomersPanel admin /> : null}
        {active === "invoices" ? <InvoicesPanel role={role} /> : null}
        {active === "inventory" && isAdmin ? <InventoryPanel /> : null}
        {active === "reports" && isAdmin ? <ReportsPanel /> : null}
        {active === "users" && isAdmin ? <UsersPanel /> : null}
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children, right }) {
  return (
    <section className="panel">
      <header className="panelHeader">
        <div>
          <h1 className="h1">{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {right ? <div className="panelRight">{right}</div> : null}
      </header>
      <div className="panelBody">{children}</div>
    </section>
  );
}

function HomePanel({ role }) {
  return (
    <Panel
      title="Dashboard"
      subtitle={
        role === "Vendedor"
          ? "Crea pedidos, consulta facturas y administra tu cartera de clientes."
          : role === "Bodega"
            ? "Prepara y despacha pedidos."
            : "Revisa ventas, inventario y administra usuarios."
      }
    >
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">Accesos por rol</div>
          <ul className="list">
            {role === "Vendedor" ? (
              <>
                <li>Pedidos: crear y ver estado</li>
                <li>Clientes: cartera (saldo / cupo)</li>
                <li>Facturas: listado + PDF</li>
              </>
            ) : null}
            {role === "Bodega" ? (
              <>
                <li>Pedidos: ver pendientes y despachar</li>
                <li>Inventario: se descuenta al despachar</li>
              </>
            ) : null}
            {role === "Admin" ? (
              <>
                <li>Reportes: ventas generales y por vendedor</li>
                <li>Inventario: catálogo + fotos</li>
                <li>Usuarios: crear cuentas por rol</li>
              </>
            ) : null}
          </ul>
        </div>

        <div className="card">
          <div className="cardTitle">Sugerencias (siguiente paso)</div>
          <ul className="list">
            <li>Estados del pedido: “En Bodega” al aprobarlo (flujo Vendedor → Bodega).</li>
            <li>Cartera real: abonos/pagos por cliente y vencimientos.</li>
            <li>Pedidos de compra: proveedor, costo, recepción y actualización de stock.</li>
            <li>Auditoría: logs de acciones por usuario.</li>
            <li>Exportación: Excel/PDF de inventario, ventas y cartera.</li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function OrdersPanel({ role }) {
  const [products, setProducts] = useState({ loading: false, items: [], error: "" });
  const [orders, setOrders] = useState({ loading: false, items: [], error: "" });
  const [draft, setDraft] = useState({ productId: "", cantidad: 1 });
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState({ creating: false, error: "" });

  async function loadProducts() {
    try {
      setProducts((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/products");
      setProducts({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar productos.";
      setProducts({ loading: false, items: [], error: message });
    }
  }

  async function loadOrders() {
    try {
      setOrders((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/orders");
      setOrders({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar pedidos.";
      setOrders({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, []);

  function addItem() {
    const product = products.items.find((p) => String(p._id) === String(draft.productId));
    const cantidad = Number(draft.cantidad);
    if (!product || !Number.isFinite(cantidad) || cantidad < 1) return;
    setItems((prev) => {
      const existing = prev.find((x) => String(x.product) === String(product._id));
      if (existing) return prev.map((x) => (String(x.product) === String(product._id) ? { ...x, cantidad: x.cantidad + cantidad } : x));
      return [...prev, { product: product._id, sku: product.sku, nombre: product.nombre, cantidad }];
    });
    setDraft({ productId: "", cantidad: 1 });
  }

  async function createOrder(e) {
    e.preventDefault();
    if (!items.length) return;
    try {
      setBusy({ creating: true, error: "" });
      await api.post("/api/orders", { items: items.map((it) => ({ product: it.product, cantidad: it.cantidad })) });
      setItems([]);
      await loadOrders();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo crear pedido.";
      setBusy({ creating: false, error: message });
      return;
    }
    setBusy({ creating: false, error: "" });
  }

  async function dispatch(orderId) {
    await api.patch(`/api/orders/${orderId}/dispatch`);
    await loadOrders();
  }

  return (
    <Panel
      title="Pedidos"
      subtitle={
        role === "Vendedor"
          ? "Crea pedidos y consulta su estado."
          : role === "Bodega"
            ? "Despacha pedidos y descuenta inventario."
            : "Consulta pedidos."
      }
      right={
        <button className="btn" type="button" onClick={loadOrders} disabled={orders.loading}>
          {orders.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {role === "Vendedor" ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="cardTitle">Nuevo pedido</div>
          <form onSubmit={createOrder} className="stack">
            <div className="row">
              <select className="input" value={draft.productId} onChange={(e) => setDraft((s) => ({ ...s, productId: e.target.value }))}>
                <option value="">Selecciona producto…</option>
                {products.items.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nombre} (SKU {p.sku}) · {formatMoney(p.precio)} · stock {p.stock}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ maxWidth: 140 }}
                type="number"
                min="1"
                value={draft.cantidad}
                onChange={(e) => setDraft((s) => ({ ...s, cantidad: Number(e.target.value) }))}
              />
              <button className="btn" type="button" onClick={addItem}>
                Agregar
              </button>
            </div>

            {!items.length ? <p className="muted">Agrega items para crear el pedido.</p> : null}
            {items.length ? (
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ width: 120 }}>Cantidad</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.product}>
                        <td>
                          {it.nombre} <span className="muted">({it.sku})</span>
                        </td>
                        <td>{it.cantidad}</td>
                        <td>
                          <button className="btn" type="button" onClick={() => setItems((p) => p.filter((x) => x.product !== it.product))}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <button className="btn primary" disabled={busy.creating || !items.length} type="submit">
              {busy.creating ? "Creando…" : "Crear pedido"}
            </button>
            {busy.error ? <p className="bad">ERROR: {busy.error}</p> : null}
          </form>
        </div>
      ) : null}

      {orders.error ? <p className="bad">ERROR: {orders.error}</p> : null}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Items</th>
              <th style={{ width: 160 }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {orders.items.map((o) => (
              <tr key={o._id}>
                <td>{o.numeroPedido ?? "—"}</td>
                <td>
                  <span className={`pill ${o.estado === "Despachado" || o.estado === "Facturado" ? "ok" : "warn"}`}>{o.estado}</span>
                </td>
                <td>{formatMoney(o.total)}</td>
                <td>{Array.isArray(o.items) ? o.items.length : 0}</td>
                <td>
                  {role === "Bodega" && (o.estado === "Pendiente" || o.estado === "En Bodega") ? (
                    <button className="btn primary" type="button" onClick={() => dispatch(o._id)}>
                      Despachar
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!orders.loading && !orders.items.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Sin pedidos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CustomersPanel({ admin }) {
  const [state, setState] = useState({ loading: false, items: [], error: "" });
  const [form, setForm] = useState({
    nombre: "",
    documento: "",
    telefono: "",
    email: "",
    direccion: "",
    cupoCredito: 0,
    saldo: 0
  });

  async function load() {
    try {
      setState((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/customers");
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar clientes.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/api/customers", form);
      setForm({ nombre: "", documento: "", telefono: "", email: "", direccion: "", cupoCredito: 0, saldo: 0 });
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo crear cliente.");
    }
  }

  return (
    <Panel
      title="Clientes"
      subtitle={admin ? "Administra clientes (cartera / cupo)." : "Tu cartera de clientes (saldo / cupo)."}
      right={
        <button className="btn" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">Nuevo cliente</div>
          <form onSubmit={create} className="stack">
            <input className="input" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} />
            <div className="row">
              <input className="input" placeholder="Documento" value={form.documento} onChange={(e) => setForm((s) => ({ ...s, documento: e.target.value }))} />
              <input className="input" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value }))} />
            </div>
            <div className="row">
              <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              <input className="input" placeholder="Dirección" value={form.direccion} onChange={(e) => setForm((s) => ({ ...s, direccion: e.target.value }))} />
            </div>
            <div className="row">
              <input className="input" type="number" placeholder="Cupo crédito" value={form.cupoCredito} onChange={(e) => setForm((s) => ({ ...s, cupoCredito: Number(e.target.value) }))} />
              <input className="input" type="number" placeholder="Saldo" value={form.saldo} onChange={(e) => setForm((s) => ({ ...s, saldo: Number(e.target.value) }))} />
            </div>
            <button className="btn primary" type="submit">
              Crear cliente
            </button>
          </form>
        </div>

        <div className="card">
          <div className="cardTitle">Listado</div>
          {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Saldo</th>
                  <th>Cupo</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((c) => (
                  <tr key={c._id}>
                    <td>
                      {c.nombre}
                      {c.documento ? <span className="muted"> · {c.documento}</span> : null}
                    </td>
                    <td>{formatMoney(c.saldo)}</td>
                    <td>{formatMoney(c.cupoCredito)}</td>
                  </tr>
                ))}
                {!state.loading && !state.items.length ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Sin clientes.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function InvoicesPanel({ role }) {
  const [state, setState] = useState({ loading: false, items: [], error: "" });
  const [emit, setEmit] = useState({ orderId: "", loading: false, error: "", ok: "" });

  async function load() {
    try {
      setState((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/invoices");
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar facturas.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function emitInvoice(e) {
    e.preventDefault();
    try {
      setEmit((s) => ({ ...s, loading: true, error: "", ok: "" }));
      await api.post(`/api/invoices/${emit.orderId}/emit`);
      setEmit({ orderId: "", loading: false, error: "", ok: "Factura emitida." });
      await load();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo emitir.";
      setEmit((s) => ({ ...s, loading: false, error: message, ok: "" }));
    }
  }

  return (
    <Panel
      title="Facturas"
      subtitle={role === "Admin" ? "Emite facturas y consulta listado." : "Consulta tus facturas emitidas."}
      right={
        <button className="btn" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {role === "Admin" ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="cardTitle">Emitir factura</div>
          <form onSubmit={emitInvoice} className="row">
            <input className="input" placeholder="orderId (Mongo)" value={emit.orderId} onChange={(e) => setEmit((s) => ({ ...s, orderId: e.target.value }))} />
            <button className="btn primary" disabled={emit.loading || !emit.orderId} type="submit">
              {emit.loading ? "Emitiendo…" : "Emitir"}
            </button>
          </form>
          {emit.error ? <p className="bad">ERROR: {emit.error}</p> : null}
          {emit.ok ? <p className="ok">{emit.ok}</p> : null}
          <p className="muted">
            Solo permite pedidos en estado <code>Despachado</code>.
          </p>
        </div>
      ) : null}

      {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Total</th>
              {role === "Admin" ? <th>Vendedor</th> : null}
              <th>CUFE</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((inv) => (
              <tr key={inv._id}>
                <td>{inv.order?.numeroPedido ?? "—"}</td>
                <td>{formatMoney(inv.order?.total)}</td>
                {role === "Admin" ? <td>{inv.vendedor?.nombre || inv.vendedor?.email || "—"}</td> : null}
                <td>
                  <code>{String(inv.CUFE || "").slice(0, 10)}…</code>
                </td>
                <td>
                  {inv.URL_PDF ? (
                    <a className="link" href={inv.URL_PDF} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!state.loading && !state.items.length ? (
              <tr>
                <td colSpan={role === "Admin" ? 5 : 4} className="muted">
                  Sin facturas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function InventoryPanel() {
  const [catalog, setCatalog] = useState({ loading: false, items: [], error: "" });
  const [imageUpload, setImageUpload] = useState({ productId: "", file: null, loading: false, error: "", ok: "" });
  const [low, setLow] = useState({ loading: false, threshold: 5, items: [], error: "" });

  async function loadCatalog() {
    try {
      setCatalog((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/products");
      setCatalog({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar el inventario.";
      setCatalog({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadLowStock() {
    try {
      setLow((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get(`/api/products/low-stock?threshold=${encodeURIComponent(low.threshold)}`);
      setLow((s) => ({ ...s, loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" }));
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar bajo inventario.";
      setLow((s) => ({ ...s, loading: false, items: [], error: message }));
    }
  }

  async function onUploadProductImage(e) {
    e.preventDefault();
    if (!imageUpload.productId) return setImageUpload((s) => ({ ...s, error: "Selecciona un producto." }));
    if (!imageUpload.file) return setImageUpload((s) => ({ ...s, error: "Selecciona una imagen." }));

    try {
      setImageUpload((s) => ({ ...s, loading: true, error: "", ok: "" }));
      const form = new FormData();
      form.append("image", imageUpload.file);
      await api.post(`/api/products/${imageUpload.productId}/image`, form);
      setImageUpload((s) => ({ ...s, loading: false, ok: "Imagen subida.", file: null }));
      await loadCatalog();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo subir la imagen.";
      setImageUpload((s) => ({ ...s, loading: false, error: message, ok: "" }));
    }
  }

  return (
    <Panel
      title="Inventario"
      subtitle="Catálogo de productos, stock y fotos."
      right={
        <button className="btn" type="button" onClick={loadCatalog} disabled={catalog.loading}>
          {catalog.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="cardTitle">Subir foto</div>
          <form onSubmit={onUploadProductImage} className="stack">
            <select className="input" value={imageUpload.productId} onChange={(e) => setImageUpload((s) => ({ ...s, productId: e.target.value }))}>
              <option value="">Selecciona un producto…</option>
              {catalog.items.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.nombre} ({p.sku})
                </option>
              ))}
            </select>
            <input className="input" type="file" accept="image/*" onChange={(e) => setImageUpload((s) => ({ ...s, file: e.target.files?.[0] || null }))} />
            <button className="btn primary" disabled={imageUpload.loading} type="submit">
              {imageUpload.loading ? "Subiendo…" : "Subir imagen"}
            </button>
          </form>
          {imageUpload.error ? <p className="bad">ERROR: {imageUpload.error}</p> : null}
          {imageUpload.ok ? <p className="ok">{imageUpload.ok}</p> : null}
        </div>

        <div className="card">
          <div className="cardTitle">Catálogo</div>
          {catalog.error ? <p className="bad">ERROR: {catalog.error}</p> : null}
          <div className="catalogGrid" style={{ marginTop: 12 }}>
            {catalog.items.map((p) => (
              <div key={p._id} className="productCard">
                {p.imageUrl ? <img className="productImg" src={p.imageUrl} alt={p.nombre} /> : <div className="productImg placeholder" />}
                <div className="productMeta">
                  <div className="productName">{p.nombre}</div>
                  <div className="muted">
                    SKU <code>{p.sku}</code> · stock <code>{p.stock}</code>
                  </div>
                  <div className="muted">
                    {formatMoney(p.precio)} · IVA <code>{p.iva}%</code>
                  </div>
                </div>
              </div>
            ))}
            {!catalog.loading && !catalog.items.length ? <p className="muted">Sin productos.</p> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="cardTitle" style={{ margin: 0 }}>
            Bajo inventario (sugerencia)
          </div>
          <div className="row">
            <input
              className="input"
              style={{ maxWidth: 140 }}
              type="number"
              min="0"
              value={low.threshold}
              onChange={(e) => setLow((s) => ({ ...s, threshold: Number(e.target.value) }))}
            />
            <button className="btn" type="button" onClick={loadLowStock} disabled={low.loading}>
              {low.loading ? "Cargando…" : "Ver"}
            </button>
          </div>
        </div>
        {low.error ? <p className="bad">ERROR: {low.error}</p> : null}
        {!low.items.length && !low.loading ? <p className="muted">Sin productos por debajo del umbral.</p> : null}
        {low.items.length ? (
          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {low.items.map((p) => (
                  <tr key={p._id}>
                    <td>
                      {p.nombre} <span className="muted">({p.sku})</span>
                    </td>
                    <td>{p.proveedor || "—"}</td>
                    <td>
                      <span className="pill warn">{p.stock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ReportsPanel() {
  const [summary, setSummary] = useState({ loading: false, data: null, error: "" });
  const [byVendor, setByVendor] = useState({ loading: false, items: [], error: "" });

  async function load() {
    try {
      setSummary({ loading: true, data: null, error: "" });
      setByVendor({ loading: true, items: [], error: "" });
      const [a, b] = await Promise.all([api.get("/api/reports/sales/summary"), api.get("/api/reports/sales/by-vendor")]);
      setSummary({ loading: false, data: a.data, error: "" });
      setByVendor({ loading: false, items: Array.isArray(b.data?.items) ? b.data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar reportes.";
      setSummary({ loading: false, data: null, error: message });
      setByVendor({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Panel
      title="Reportes"
      subtitle="Ventas generales y por vendedor (según facturas emitidas)."
      right={
        <button className="btn" type="button" onClick={load} disabled={summary.loading || byVendor.loading}>
          {summary.loading || byVendor.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {summary.error ? <p className="bad">ERROR: {summary.error}</p> : null}
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">Resumen (últimos 30 días)</div>
          <div className="kpis">
            <div className="kpi">
              <div className="kpiLabel">Facturas</div>
              <div className="kpiValue">{summary.data?.invoices ?? "—"}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Ventas</div>
              <div className="kpiValue">{summary.data ? formatMoney(summary.data.totalSales) : "—"}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">Ventas por vendedor</div>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Facturas</th>
                  <th>Ventas</th>
                </tr>
              </thead>
              <tbody>
                {byVendor.items.map((r) => (
                  <tr key={r.vendedorId}>
                    <td>{r.vendedor?.nombre || r.vendedor?.email || r.vendedorId}</td>
                    <td>{r.invoices}</td>
                    <td>{formatMoney(r.totalSales)}</td>
                  </tr>
                ))}
                {!byVendor.loading && !byVendor.items.length ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Sin datos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function UsersPanel() {
  const [form, setForm] = useState({ email: "", password: "", role: "Vendedor", nombre: "" });
  const [state, setState] = useState({ loading: false, error: "", ok: "" });

  async function create(e) {
    e.preventDefault();
    try {
      setState({ loading: true, error: "", ok: "" });
      await api.post("/api/auth/register", form);
      setState({ loading: false, error: "", ok: "Usuario creado." });
      setForm({ email: "", password: "", role: "Vendedor", nombre: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo crear.";
      setState({ loading: false, error: message, ok: "" });
    }
  }

  return (
    <Panel title="Usuarios" subtitle="Crear usuarios (solo Admin).">
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="cardTitle">Nuevo usuario</div>
        <form onSubmit={create} className="stack">
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          <input className="input" placeholder="Contraseña" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
          <div className="row">
            <select className="input" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
              <option value="Vendedor">Vendedor</option>
              <option value="Bodega">Bodega</option>
              <option value="Admin">Admin</option>
            </select>
            <input className="input" placeholder="Nombre (opcional)" value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} />
          </div>
          <button className="btn primary" disabled={state.loading} type="submit">
            {state.loading ? "Creando…" : "Crear usuario"}
          </button>
        </form>
        {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
        {state.ok ? <p className="ok">{state.ok}</p> : null}
      </div>
    </Panel>
  );
}
