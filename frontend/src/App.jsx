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
  const [sideOpen, setSideOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia?.("(min-width: 980px)")?.matches;
    setSideOpen(Boolean(isDesktop));
  }, []);

  const nav = useMemo(() => {
    if (!role) return [];
    if (role === "Cliente") return ["home", "search", "catalog", "shop", "cart", "orders", "invoices"];
    if (role === "Vendedor") return ["home", "search", "catalog", "orders", "customers", "invoices"];
    if (role === "Bodega") return ["home", "orders", "inventory"];
    return ["home", "reports", "inventory", "purchases", "audit", "invoices", "users"];
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
    <div className="shell">
      <header className="topbar">
        <div className="topLeft">
          <button className="iconBtn" type="button" onClick={() => setSideOpen((s) => !s)} aria-label="Abrir menú">
            ☰
          </button>
          <div className="topBrand">SISTEGO</div>
        </div>
        <div className="topRight">
          <button className="iconBtn" type="button" onClick={logout} aria-label="Salir">
            ⎋
          </button>
        </div>
      </header>

      <div className="dashPage">
        {sideOpen ? <button className="backdrop" type="button" aria-label="Cerrar menú" onClick={() => setSideOpen(false)} /> : null}

        <aside className={`side ${sideOpen ? "open" : ""}`}>
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
              onClick={() => {
                setActive(key);
                if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 979px)")?.matches) setSideOpen(false);
              }}
            >
              {key === "home" ? "Inicio" : null}
              {key === "orders" ? "Pedidos" : null}
              {key === "customers" ? "Clientes" : null}
              {key === "invoices" ? "Facturas" : null}
              {key === "shop" ? "Productos" : null}
              {key === "cart" ? "Carrito" : null}
              {key === "search" ? "Buscar Artículos" : null}
              {key === "catalog" ? "Catálogo" : null}
              {key === "inventory" ? "Inventario" : null}
              {key === "reports" ? "Reportes" : null}
              {key === "purchases" ? "Compras" : null}
              {key === "audit" ? "Auditoría" : null}
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
        {active === "home" ? <HomePanel role={role} go={setActive} /> : null}
        {active === "search" ? <SearchArticlesPanel /> : null}
        {active === "catalog" ? <CatalogPanel /> : null}
        {active === "orders" && role !== "Cliente" ? <OrdersPanel role={role} userId={auth.user?.id} /> : null}
        {active === "orders" && role === "Cliente" ? <CustomerOrdersPanel /> : null}
        {active === "shop" && role === "Cliente" ? <ShopPanel /> : null}
        {active === "cart" && role === "Cliente" ? <CartPanel /> : null}
        {active === "customers" && isVendor ? <CustomersPanel /> : null}
        {active === "customers" && isAdmin ? <CustomersPanel admin /> : null}
        {active === "invoices" ? <InvoicesPanel role={role} /> : null}
        {active === "inventory" && isAdmin ? <InventoryPanel /> : null}
        {active === "inventory" && isBodega ? <BodegaInventoryPanel /> : null}
        {active === "purchases" && isAdmin ? <PurchasesPanel /> : null}
        {active === "audit" && isAdmin ? <AuditPanel /> : null}
        {active === "reports" && isAdmin ? <ReportsPanel /> : null}
        {active === "users" && isAdmin ? <UsersPanel /> : null}
        </main>
      </div>
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

function HomePanel({ role, go }) {
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
      <div className="tileGrid">
        {role === "Cliente" ? (
          <>
            <button className="tile" type="button" onClick={() => go("shop")}>
              <div className="tileIcon">🛒</div>
              <div className="tileText">Productos</div>
            </button>
            <button className="tile" type="button" onClick={() => go("cart")}>
              <div className="tileIcon">🧺</div>
              <div className="tileText">Carrito</div>
            </button>
            <button className="tile" type="button" onClick={() => go("orders")}>
              <div className="tileIcon">📦</div>
              <div className="tileText">Mis pedidos</div>
            </button>
            <button className="tile" type="button" onClick={() => go("invoices")}>
              <div className="tileIcon">🧾</div>
              <div className="tileText">Mis facturas</div>
            </button>
          </>
        ) : null}
        {role === "Vendedor" ? (
          <>
            <button className="tile" type="button" onClick={() => go("orders")}>
              <div className="tileIcon">📝</div>
              <div className="tileText">Pedidos</div>
            </button>
            <button className="tile" type="button" onClick={() => go("customers")}>
              <div className="tileIcon">📒</div>
              <div className="tileText">Cartera</div>
            </button>
            <button className="tile" type="button" onClick={() => go("invoices")}>
              <div className="tileIcon">🧾</div>
              <div className="tileText">Facturas</div>
            </button>
          </>
        ) : null}
        {role === "Bodega" ? (
          <>
            <button className="tile" type="button" onClick={() => go("orders")}>
              <div className="tileIcon">🏷️</div>
              <div className="tileText">Pedidos</div>
            </button>
          </>
        ) : null}
        {role === "Admin" ? (
          <>
            <button className="tile" type="button" onClick={() => go("reports")}>
              <div className="tileIcon">📊</div>
              <div className="tileText">Ventas</div>
            </button>
            <button className="tile" type="button" onClick={() => go("inventory")}>
              <div className="tileIcon">📦</div>
              <div className="tileText">Inventario</div>
            </button>
            <button className="tile" type="button" onClick={() => go("purchases")}>
              <div className="tileIcon">🧾</div>
              <div className="tileText">Compras</div>
            </button>
            <button className="tile" type="button" onClick={() => go("audit")}>
              <div className="tileIcon">🕵️</div>
              <div className="tileText">Auditoría</div>
            </button>
          </>
        ) : null}
      </div>
    </Panel>
  );
}

function OrdersPanel({ role, userId }) {
  const [products, setProducts] = useState({ loading: false, items: [], error: "" });
  const [meta, setMeta] = useState({ loading: false, categories: [], subCategories: [], barcodes: [], error: "" });
  const [customers, setCustomers] = useState({ loading: false, items: [], error: "" });
  const [orders, setOrders] = useState({ loading: false, items: [], error: "" });
  const [draft, setDraft] = useState({ productId: "", cantidad: 1, customerId: "" });
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState({ creating: false, error: "" });
  const [filters, setFilters] = useState({
    codigo: "",
    descripcion: "",
    categoria: "",
    subCategoria: "",
    codigoBarras: "",
    referencia: ""
  });

  const draftKey = role === "Vendedor" && userId ? `draft_order_${userId}` : "";

  useEffect(() => {
    if (!draftKey) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    const saved = safeJsonParse(raw, null);
    if (saved?.items) setItems(saved.items);
    if (saved?.draft) setDraft(saved.draft);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify({ items, draft }));
  }, [draftKey, items, draft]);

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

  async function loadMeta() {
    try {
      setMeta((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/products/meta");
      setMeta({
        loading: false,
        categories: Array.isArray(data?.categories) ? data.categories : [],
        subCategories: Array.isArray(data?.subCategories) ? data.subCategories : [],
        barcodes: Array.isArray(data?.barcodes) ? data.barcodes : [],
        error: ""
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar filtros.";
      setMeta({ loading: false, categories: [], subCategories: [], barcodes: [], error: message });
    }
  }

  async function loadCustomers() {
    if (role !== "Vendedor") return;
    try {
      setCustomers((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/customers");
      setCustomers({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar clientes.";
      setCustomers({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    loadProducts();
    loadMeta();
    loadCustomers();
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
    if (role === "Vendedor" && !draft.customerId) {
      setBusy({ creating: false, error: "Selecciona un cliente para el pedido." });
      return;
    }
    try {
      setBusy({ creating: true, error: "" });
      await api.post("/api/orders", {
        customerId: draft.customerId,
        items: items.map((it) => ({ product: it.product, cantidad: it.cantidad }))
      });
      setItems([]);
      if (draftKey) localStorage.removeItem(draftKey);
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

  async function approve(orderId) {
    await api.patch(`/api/orders/${orderId}/approve`);
    await loadOrders();
  }

  async function cancel(orderId) {
    await api.patch(`/api/orders/${orderId}/cancel`);
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
            <select
              className="input"
              value={draft.customerId}
              onChange={(e) => setDraft((s) => ({ ...s, customerId: e.target.value }))}
            >
              <option value="">Selecciona cliente…</option>
              {customers.items.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre} {c.documento ? `· ${c.documento}` : ""}
                </option>
              ))}
            </select>
            {customers.error ? <p className="bad">ERROR: {customers.error}</p> : null}
            <div className="grid2">
              <input
                className="input"
                placeholder="Código"
                value={filters.codigo}
                onChange={(e) => setFilters((s) => ({ ...s, codigo: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Descripción"
                value={filters.descripcion}
                onChange={(e) => setFilters((s) => ({ ...s, descripcion: e.target.value }))}
              />
            </div>
            <div className="grid2">
              <select className="input" value={filters.categoria} onChange={(e) => setFilters((s) => ({ ...s, categoria: e.target.value, subCategoria: "" }))}>
                <option value="">Categoría…</option>
                {meta.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select className="input" value={filters.subCategoria} onChange={(e) => setFilters((s) => ({ ...s, subCategoria: e.target.value }))}>
                <option value="">SubCategoría…</option>
                {meta.subCategories
                  .filter((s) => !filters.categoria || true)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid2">
              <input
                className="input"
                placeholder="Referencia"
                value={filters.referencia}
                onChange={(e) => setFilters((s) => ({ ...s, referencia: e.target.value }))}
              />
              <select className="input" value={filters.codigoBarras} onChange={(e) => setFilters((s) => ({ ...s, codigoBarras: e.target.value }))}>
                <option value="">Código barras…</option>
                {meta.barcodes.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <select className="input" value={draft.productId} onChange={(e) => setDraft((s) => ({ ...s, productId: e.target.value }))}>
                <option value="">Selecciona producto…</option>
                {products.items
                  .filter((p) => {
                    const okCodigo = !filters.codigo || String(p.sku || "").toLowerCase().includes(String(filters.codigo).toLowerCase());
                    const okDesc =
                      !filters.descripcion ||
                      String(p.nombre || "").toLowerCase().includes(String(filters.descripcion).toLowerCase()) ||
                      String(p.descripcion || "").toLowerCase().includes(String(filters.descripcion).toLowerCase());
                    const okCat = !filters.categoria || String(p.categoria || "") === String(filters.categoria);
                    const okSub = !filters.subCategoria || String(p.subCategoria || "") === String(filters.subCategoria);
                    const okRef = !filters.referencia || String(p.referencia || "").toLowerCase().includes(String(filters.referencia).toLowerCase());
                    const okBar =
                      !filters.codigoBarras || String(p.codigoBarras || "").toLowerCase().includes(String(filters.codigoBarras).toLowerCase());
                    return okCodigo && okDesc && okCat && okSub && okRef && okBar;
                  })
                  .map((p) => (
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
                  <span
                    className={`pill ${
                      o.estado === "Despachado" || o.estado === "Facturado"
                        ? "ok"
                        : o.estado === "Cancelado"
                          ? "bad"
                          : "warn"
                    }`}
                  >
                    {o.estado}
                  </span>
                </td>
                <td>{formatMoney(o.total)}</td>
                <td>{Array.isArray(o.items) ? o.items.length : 0}</td>
                <td>
                  {role === "Admin" && o.estado === "Pendiente" ? (
                    <div className="row">
                      <button className="btn primary" type="button" onClick={() => approve(o._id)}>
                        Aprobar
                      </button>
                      <button className="btn" type="button" onClick={() => cancel(o._id)}>
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                  {role === "Admin" && o.estado === "En Bodega" ? (
                    <button className="btn" type="button" onClick={() => cancel(o._id)}>
                      Cancelar
                    </button>
                  ) : null}
                  {role === "Bodega" && o.estado === "En Bodega" ? (
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
    nit: "",
    dv: "",
    razonSocial: "",
    nombreComercial: "",
    ciudad: "",
    departamento: "",
    pais: "",
    regimen: "",
    responsabilidades: [],
    rutUrl: "",
    rutPublicId: "",
    cupoCredito: 0,
    saldo: 0
  });
  const [rut, setRut] = useState({ file: null, loading: false, error: "", ok: "" });

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
      setForm({
        nombre: "",
        documento: "",
        telefono: "",
        email: "",
        direccion: "",
        nit: "",
        dv: "",
        razonSocial: "",
        nombreComercial: "",
        ciudad: "",
        departamento: "",
        pais: "",
        regimen: "",
        responsabilidades: [],
        rutUrl: "",
        rutPublicId: "",
        cupoCredito: 0,
        saldo: 0
      });
      setRut({ file: null, loading: false, error: "", ok: "" });
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo crear cliente.");
    }
  }

  async function readRut(e) {
    e.preventDefault();
    if (!rut.file) return setRut((s) => ({ ...s, error: "Selecciona un RUT (PDF o imagen)." }));
    try {
      setRut((s) => ({ ...s, loading: true, error: "", ok: "" }));
      const fd = new FormData();
      fd.append("file", rut.file);
      const { data } = await api.post("/api/customers/rut/parse", fd);
      const extracted = data?.extracted || {};

      const nit = String(extracted?.nit || "").trim();
      const dv = String(extracted?.dv || "").trim();
      const razonSocial = String(extracted?.razonSocial || "").trim();

      setForm((s) => ({
        ...s,
        nit,
        dv,
        razonSocial,
        nombreComercial: String(extracted?.nombreComercial || "").trim(),
        ciudad: String(extracted?.ciudad || "").trim(),
        departamento: String(extracted?.departamento || "").trim(),
        pais: String(extracted?.pais || "").trim(),
        regimen: String(extracted?.regimen || "").trim(),
        responsabilidades: Array.isArray(extracted?.responsabilidades) ? extracted.responsabilidades : [],
        rutUrl: String(data?.rutUrl || ""),
        rutPublicId: String(data?.rutPublicId || ""),

        nombre: razonSocial || s.nombre,
        documento: nit && dv ? `${nit}-${dv}` : nit || s.documento,
        email: String(extracted?.email || "").trim() || s.email,
        telefono: String(extracted?.telefono || "").trim() || s.telefono,
        direccion: String(extracted?.direccion || "").trim() || s.direccion
      }));

      setRut((s) => ({ ...s, loading: false, ok: "RUT leído. Revisa y ajusta los campos." }));
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo leer el RUT.";
      setRut((s) => ({ ...s, loading: false, error: message, ok: "" }));
    }
  }

  const [pay, setPay] = useState({ customerId: "", amount: 0, note: "", loading: false, error: "", ok: "" });
  const [payments, setPayments] = useState({ loading: false, items: [], error: "" });

  async function loadPayments(customerId) {
    try {
      setPayments({ loading: true, items: [], error: "" });
      const { data } = await api.get(`/api/customers/${customerId}/payments`);
      setPayments({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar pagos.";
      setPayments({ loading: false, items: [], error: message });
    }
  }

  async function createPayment(e) {
    e.preventDefault();
    if (!pay.customerId) return setPay((s) => ({ ...s, error: "Selecciona un cliente." }));
    try {
      setPay((s) => ({ ...s, loading: true, error: "", ok: "" }));
      await api.post(`/api/customers/${pay.customerId}/payments`, { amount: Number(pay.amount), note: pay.note });
      setPay({ customerId: "", amount: 0, note: "", loading: false, error: "", ok: "Pago registrado." });
      await load();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo registrar pago.";
      setPay((s) => ({ ...s, loading: false, error: message, ok: "" }));
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
            <div className="card" style={{ boxShadow: "none" }}>
              <div className="cardTitle">RUT (autocompletar con OpenAI)</div>
              <div className="stack">
                <input
                  className="input"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setRut((s) => ({ ...s, file: e.target.files?.[0] || null, error: "", ok: "" }))}
                />
                <button className="btn primary" type="button" onClick={readRut} disabled={rut.loading || !rut.file}>
                  {rut.loading ? "Leyendo…" : "Leer RUT y rellenar"}
                </button>
                {rut.error ? <p className="bad">ERROR: {rut.error}</p> : null}
                {rut.ok ? <p className="ok">{rut.ok}</p> : null}
                {form.rutUrl ? (
                  <p className="muted">
                    Archivo:{" "}
                    <a className="link" href={form.rutUrl} target="_blank" rel="noreferrer">
                      ver RUT
                    </a>
                  </p>
                ) : null}
                <p className="muted">Requiere `OPENAI_API_KEY` configurado en el backend.</p>
              </div>
            </div>
            <input className="input" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} />
            <div className="row">
              <input className="input" placeholder="Documento (NIT-DV)" value={form.documento} onChange={(e) => setForm((s) => ({ ...s, documento: e.target.value }))} />
              <input className="input" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value }))} />
            </div>
            <div className="row">
              <input className="input" placeholder="Email (para FE)" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
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

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="cardTitle">Registrar pago / abono</div>
          <form onSubmit={createPayment} className="stack">
            <select className="input" value={pay.customerId} onChange={(e) => setPay((s) => ({ ...s, customerId: e.target.value }))}>
              <option value="">Selecciona un cliente…</option>
              {state.items.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre} {c.documento ? `(${c.documento})` : ""}
                </option>
              ))}
            </select>
            <div className="row">
              <input
                className="input"
                type="number"
                min="0"
                placeholder="Valor"
                value={pay.amount}
                onChange={(e) => setPay((s) => ({ ...s, amount: Number(e.target.value) }))}
              />
              <input
                className="input"
                placeholder="Nota (opcional)"
                value={pay.note}
                onChange={(e) => setPay((s) => ({ ...s, note: e.target.value }))}
              />
            </div>
            <button className="btn primary" disabled={pay.loading} type="submit">
              {pay.loading ? "Guardando…" : "Registrar pago"}
            </button>
          </form>
          {pay.error ? <p className="bad">ERROR: {pay.error}</p> : null}
          {pay.ok ? <p className="ok">{pay.ok}</p> : null}
          <p className="muted">El saldo del cliente disminuye automáticamente.</p>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="cardTitle" style={{ margin: 0 }}>
              Historial de pagos
            </div>
            <button className="btn" type="button" onClick={() => (pay.customerId ? loadPayments(pay.customerId) : null)} disabled={!pay.customerId || payments.loading}>
              {payments.loading ? "Cargando…" : "Ver"}
            </button>
          </div>
          {payments.error ? <p className="bad">ERROR: {payments.error}</p> : null}
          {!payments.loading && !payments.items.length ? <p className="muted">Selecciona un cliente y pulsa Ver.</p> : null}
          {payments.items.length ? (
            <div className="tableWrap" style={{ marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Valor</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.items.map((p) => (
                    <tr key={p._id}>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                      <td>{formatMoney(p.amount)}</td>
                      <td>{p.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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
  const apiBase = import.meta?.env?.VITE_API_URL || "";
  const { meta, reload: reloadMeta } = useProductsMeta();
  const [create, setCreate] = useState({
    sku: "",
    nombre: "",
    descripcion: "",
    categoria: "",
    subCategoria: "",
    referencia: "",
    codigoBarras: "",
    proveedor: "",
    costo: "",
    precio: "",
    stock: "",
    iva: 19,
    unidadMedida: "UND",
    loading: false,
    error: "",
    ok: ""
  });
  const [bulk, setBulk] = useState({ file: null, loading: false, error: "", ok: "" });

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

  async function onCreateProduct(e) {
    e.preventDefault();
    try {
      setCreate((s) => ({ ...s, loading: true, error: "", ok: "" }));
      const payload = {
        sku: create.sku,
        nombre: create.nombre,
        descripcion: create.descripcion,
        categoria: create.categoria,
        subCategoria: create.subCategoria,
        referencia: create.referencia,
        codigoBarras: create.codigoBarras,
        proveedor: create.proveedor,
        costo: Number(create.costo || 0),
        precio: Number(create.precio || 0),
        stock: Number(create.stock || 0),
        iva: Number(create.iva),
        unidadMedida: create.unidadMedida
      };
      await api.post("/api/products", payload);
      setCreate((s) => ({ ...s, loading: false, ok: "Producto creado." }));
      await loadCatalog();
      await reloadMeta();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo crear.";
      setCreate((s) => ({ ...s, loading: false, error: message, ok: "" }));
    }
  }

  async function onBulkUpload(e) {
    e.preventDefault();
    if (!bulk.file) return setBulk((s) => ({ ...s, error: "Selecciona un archivo." }));
    try {
      setBulk((s) => ({ ...s, loading: true, error: "", ok: "" }));
      const form = new FormData();
      form.append("file", bulk.file);
      const { data } = await api.post("/api/products/bulk", form);
      setBulk((s) => ({ ...s, loading: false, ok: `Carga OK: ${data?.insertedCount || 0} productos.` }));
      await loadCatalog();
      await reloadMeta();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar archivo.";
      setBulk((s) => ({ ...s, loading: false, error: message, ok: "" }));
    }
  }

  return (
    <Panel
      title="Inventario"
      subtitle="Catálogo de productos, stock y fotos."
      right={
        <div className="row">
          <a className="btn" href={`${apiBase}/api/products/export.xlsx`} target="_blank" rel="noreferrer">
            Exportar Excel
          </a>
          <button className="btn" type="button" onClick={loadCatalog} disabled={catalog.loading}>
            {catalog.loading ? "Cargando…" : "Refrescar"}
          </button>
        </div>
      }
    >
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="cardTitle">Crear producto</div>
          <form onSubmit={onCreateProduct} className="stack">
            <div className="grid2">
              <input className="input" placeholder="Código (SKU)" value={create.sku} onChange={(e) => setCreate((s) => ({ ...s, sku: e.target.value }))} />
              <input className="input" placeholder="Nombre" value={create.nombre} onChange={(e) => setCreate((s) => ({ ...s, nombre: e.target.value }))} />
            </div>
            <input className="input" placeholder="Descripción" value={create.descripcion} onChange={(e) => setCreate((s) => ({ ...s, descripcion: e.target.value }))} />
            <div className="grid2">
              <div>
                <input
                  className="input"
                  list="product_categories"
                  placeholder="Categoría… (puedes crear una nueva)"
                  value={create.categoria}
                  onChange={(e) => setCreate((s) => ({ ...s, categoria: e.target.value }))}
                />
                <datalist id="product_categories">
                  {meta.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <input className="input" placeholder="SubCategoría" value={create.subCategoria} onChange={(e) => setCreate((s) => ({ ...s, subCategoria: e.target.value }))} />
            </div>
            <div className="grid2">
              <input className="input" placeholder="Referencia" value={create.referencia} onChange={(e) => setCreate((s) => ({ ...s, referencia: e.target.value }))} />
              <input className="input" placeholder="Código barras" value={create.codigoBarras} onChange={(e) => setCreate((s) => ({ ...s, codigoBarras: e.target.value }))} />
            </div>
            <div className="grid2">
              <input className="input" placeholder="Proveedor" value={create.proveedor} onChange={(e) => setCreate((s) => ({ ...s, proveedor: e.target.value }))} />
              <input className="input" placeholder="Unidad medida" value={create.unidadMedida} onChange={(e) => setCreate((s) => ({ ...s, unidadMedida: e.target.value }))} />
            </div>
            <div>
              <div className="muted">Costo (COP)</div>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Ej: 15000"
                value={create.costo}
                onChange={(e) => setCreate((s) => ({ ...s, costo: e.target.value }))}
              />
            </div>
            <div className="grid2">
              <div>
                <div className="muted">Precio (COP)</div>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 25000"
                  value={create.precio}
                  onChange={(e) => setCreate((s) => ({ ...s, precio: e.target.value }))}
                />
              </div>
              <div>
                <div className="muted">Stock inicial</div>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  value={create.stock}
                  onChange={(e) => setCreate((s) => ({ ...s, stock: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <div className="muted">IVA (%)</div>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="Ej: 19"
                value={create.iva}
                onChange={(e) => setCreate((s) => ({ ...s, iva: Number(e.target.value) }))}
              />
            </div>
            <button className="btn primary" disabled={create.loading} type="submit">
              {create.loading ? "Guardando…" : "Crear"}
            </button>
          </form>
          {create.error ? <p className="bad">ERROR: {create.error}</p> : null}
          {create.ok ? <p className="ok">{create.ok}</p> : null}
        </div>

        <div className="card">
          <div className="cardTitle">Carga rápida (CSV / Excel)</div>
          <form onSubmit={onBulkUpload} className="stack">
            <input
              className="input"
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => setBulk((s) => ({ ...s, file: e.target.files?.[0] || null }))}
            />
            <button className="btn primary" disabled={bulk.loading} type="submit">
              {bulk.loading ? "Cargando…" : "Cargar"}
            </button>
          </form>
          {bulk.error ? <p className="bad">ERROR: {bulk.error}</p> : null}
          {bulk.ok ? <p className="ok">{bulk.ok}</p> : null}
          <p className="muted">
            Columnas soportadas: <code>sku</code>, <code>nombre</code>, <code>descripcion</code>, <code>categoria</code>,{" "}
            <code>subCategoria</code>, <code>referencia</code>, <code>codigoBarras</code>, <code>precio</code>,{" "}
            <code>stock</code>, <code>iva</code>, <code>unidadMedida</code>, <code>proveedor</code>.
          </p>
        </div>

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

function BodegaInventoryPanel() {
  const [state, setState] = useState({ loading: false, items: [], error: "" });
  const [q, setQ] = useState({ codigo: "", descripcion: "" });
  const [saving, setSaving] = useState({ id: "", error: "" });

  async function load() {
    try {
      setState((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/products", { params: q });
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar inventario.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStock(id, stock) {
    try {
      setSaving({ id, error: "" });
      await api.patch(`/api/products/${id}/stock`, { stock: Number(stock) });
      await load();
      setSaving({ id: "", error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo actualizar stock.";
      setSaving({ id, error: message });
    }
  }

  async function deactivate(id) {
    const ok = confirm("¿Desactivar este producto? (no se eliminará de la BD, solo quedará oculto)");
    if (!ok) return;
    try {
      setSaving({ id, error: "" });
      await api.delete(`/api/products/${id}`);
      await load();
      setSaving({ id: "", error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo desactivar.";
      setSaving({ id, error: message });
    }
  }

  return (
    <Panel
      title="Inventario (Bodega)"
      subtitle="Ajusta cantidades y desactiva productos cargados por error."
      right={
        <button className="btn" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      <div className="card">
        <div className="grid2">
          <input className="input" placeholder="Código" value={q.codigo} onChange={(e) => setQ((s) => ({ ...s, codigo: e.target.value }))} />
          <input
            className="input"
            placeholder="Descripción"
            value={q.descripcion}
            onChange={(e) => setQ((s) => ({ ...s, descripcion: e.target.value }))}
          />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" type="button" onClick={load} disabled={state.loading}>
            Buscar
          </button>
          <button className="btn" type="button" onClick={() => setQ({ codigo: "", descripcion: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
      {saving.error ? <p className="bad">ERROR: {saving.error}</p> : null}
      <div className="tableWrap" style={{ marginTop: 14 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Stock</th>
              <th style={{ width: 210 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((p) => (
              <BodegaProductRow
                key={p._id}
                product={p}
                busy={saving.id === p._id}
                onSetStock={(stock) => setStock(p._id, stock)}
                onDeactivate={() => deactivate(p._id)}
              />
            ))}
            {!state.loading && !state.items.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Sin productos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BodegaProductRow({ product, busy, onSetStock, onDeactivate }) {
  const [stock, setStockValue] = useState(Number(product.stock || 0));

  useEffect(() => {
    setStockValue(Number(product.stock || 0));
  }, [product.stock]);

  return (
    <tr>
      <td>
        <code>{product.sku}</code>
      </td>
      <td>{product.descripcion || product.nombre}</td>
      <td style={{ width: 180 }}>
        <input className="input" type="number" min="0" value={stock} onChange={(e) => setStockValue(Number(e.target.value))} />
      </td>
      <td>
        <div className="row">
          <button className="btn primary" type="button" disabled={busy} onClick={() => onSetStock(stock)}>
            Guardar
          </button>
          <button className="btn" type="button" disabled={busy} onClick={onDeactivate}>
            Desactivar
          </button>
        </div>
      </td>
    </tr>
  );
}

function PurchasesPanel() {
  const [suggest, setSuggest] = useState({ loading: false, threshold: 5, items: [], error: "" });
  const [list, setList] = useState({ loading: false, items: [], error: "" });
  const [draft, setDraft] = useState({ proveedor: "", items: [], creating: false, error: "", ok: "" });

  async function loadSuggest() {
    try {
      setSuggest((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get(`/api/products/low-stock?threshold=${encodeURIComponent(suggest.threshold)}`);
      setSuggest((s) => ({ ...s, loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" }));
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar sugerencia.";
      setSuggest((s) => ({ ...s, loading: false, items: [], error: message }));
    }
  }

  async function loadPOs() {
    try {
      setList((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/purchase-orders");
      setList({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar OC.";
      setList({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    loadSuggest();
    loadPOs();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of suggest.items) {
      const prov = p.proveedor || "(sin proveedor)";
      const arr = map.get(prov) || [];
      arr.push(p);
      map.set(prov, arr);
    }
    return [...map.entries()].map(([proveedor, items]) => ({ proveedor, items }));
  }, [suggest.items]);

  function startDraft(proveedor, items) {
    setDraft({
      proveedor,
      items: items.map((p) => ({
        product: p._id,
        nombre: p.nombre,
        sku: p.sku,
        stock: p.stock,
        cantidad: Math.max(1, Number(suggest.threshold) * 2 - Number(p.stock || 0)),
        costoUnit: 0
      })),
      creating: false,
      error: "",
      ok: ""
    });
  }

  async function createPO(e) {
    e.preventDefault();
    try {
      setDraft((s) => ({ ...s, creating: true, error: "", ok: "" }));
      await api.post("/api/purchase-orders", {
        proveedor: draft.proveedor,
        items: draft.items
          .filter((it) => Number(it.cantidad) > 0)
          .map((it) => ({ product: it.product, cantidad: Number(it.cantidad), costoUnit: Number(it.costoUnit || 0) }))
      });
      setDraft((s) => ({ ...s, creating: false, ok: "Orden de compra creada." }));
      await loadPOs();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo crear OC.";
      setDraft((s) => ({ ...s, creating: false, error: message, ok: "" }));
    }
  }

  async function receive(poId) {
    await api.patch(`/api/purchase-orders/${poId}/receive`);
    await loadPOs();
    await loadSuggest();
  }

  return (
    <Panel
      title="Compras"
      subtitle="Crea órdenes de compra por proveedor y recibe para aumentar inventario."
      right={
        <button className="btn" type="button" onClick={loadPOs} disabled={list.loading}>
          {list.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="cardTitle" style={{ margin: 0 }}>
              Sugerencia bajo inventario
            </div>
            <div className="row">
              <input
                className="input"
                style={{ maxWidth: 140 }}
                type="number"
                min="0"
                value={suggest.threshold}
                onChange={(e) => setSuggest((s) => ({ ...s, threshold: Number(e.target.value) }))}
              />
              <button className="btn" type="button" onClick={loadSuggest} disabled={suggest.loading}>
                {suggest.loading ? "Cargando…" : "Actualizar"}
              </button>
            </div>
          </div>
          {suggest.error ? <p className="bad">ERROR: {suggest.error}</p> : null}
          {!grouped.length && !suggest.loading ? <p className="muted">Sin productos por debajo del umbral.</p> : null}
          {grouped.map((g) => (
            <div key={g.proveedor} className="card" style={{ marginTop: 12, boxShadow: "none" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="cardTitle" style={{ margin: 0 }}>
                  {g.proveedor}
                </div>
                <button className="btn primary" type="button" onClick={() => startDraft(g.proveedor, g.items)}>
                  Crear OC
                </button>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {g.items.length} producto(s)
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="cardTitle">Órdenes de compra</div>
          {list.error ? <p className="bad">ERROR: {list.error}</p> : null}
          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th>Items</th>
                  <th style={{ width: 140 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((po) => (
                  <tr key={po._id}>
                    <td>{po.proveedor}</td>
                    <td>
                      <span className={`pill ${po.estado === "Recibido" ? "ok" : po.estado === "Cancelado" ? "bad" : "warn"}`}>{po.estado}</span>
                    </td>
                    <td>{Array.isArray(po.items) ? po.items.length : 0}</td>
                    <td>
                      {po.estado === "Pendiente" ? (
                        <button className="btn primary" type="button" onClick={() => receive(po._id)}>
                          Recibir
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!list.loading && !list.items.length ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Sin órdenes de compra.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {draft.proveedor ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardTitle">Nueva OC — {draft.proveedor}</div>
          <form onSubmit={createPO} className="stack">
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock</th>
                    <th>Cantidad</th>
                    <th>Costo unit</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((it, idx) => (
                    <tr key={it.product}>
                      <td>
                        {it.nombre} <span className="muted">({it.sku})</span>
                      </td>
                      <td>{it.stock}</td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 140 }}
                          type="number"
                          min="0"
                          value={it.cantidad}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              items: s.items.map((x, i) => (i === idx ? { ...x, cantidad: Number(e.target.value) } : x))
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 160 }}
                          type="number"
                          min="0"
                          value={it.costoUnit}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              items: s.items.map((x, i) => (i === idx ? { ...x, costoUnit: Number(e.target.value) } : x))
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row">
              <button className="btn primary" disabled={draft.creating} type="submit">
                {draft.creating ? "Creando…" : "Crear OC"}
              </button>
              <button className="btn" type="button" onClick={() => setDraft({ proveedor: "", items: [], creating: false, error: "", ok: "" })}>
                Cerrar
              </button>
            </div>
            {draft.error ? <p className="bad">ERROR: {draft.error}</p> : null}
            {draft.ok ? <p className="ok">{draft.ok}</p> : null}
          </form>
        </div>
      ) : null}
    </Panel>
  );
}

function AuditPanel() {
  const [state, setState] = useState({ loading: false, items: [], error: "" });

  async function load() {
    try {
      setState({ loading: true, items: [], error: "" });
      const { data } = await api.get("/api/audit");
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar auditoría.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Panel
      title="Auditoría"
      subtitle="Registro básico de acciones (últimos 200 eventos)."
      right={
        <button className="btn" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Entidad</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((a) => (
              <tr key={a._id}>
                <td>{new Date(a.createdAt).toLocaleString()}</td>
                <td>
                  {a.email ? a.email : "—"} <span className="muted">({a.role || "—"})</span>
                </td>
                <td>
                  <code>{a.action}</code>
                </td>
                <td>
                  <code>{a.entity}</code> {a.entityId ? <span className="muted">· {a.entityId}</span> : null}
                </td>
              </tr>
            ))}
            {!state.loading && !state.items.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Sin eventos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function getCartKey() {
  return "cart_cliente";
}

function loadCart() {
  const raw = localStorage.getItem(getCartKey());
  const data = safeJsonParse(raw || "null", null);
  return Array.isArray(data) ? data : [];
}

function saveCart(items) {
  localStorage.setItem(getCartKey(), JSON.stringify(items));
}

function ShopPanel() {
  const [state, setState] = useState({ loading: false, items: [], error: "" });
  const [cart, setCart] = useState(() => loadCart());

  async function load() {
    try {
      setState({ loading: true, items: [], error: "" });
      const { data } = await api.get("/api/shop/products");
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar productos.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  function addToCart(p) {
    setCart((prev) => {
      const existing = prev.find((x) => String(x.product) === String(p._id));
      if (existing) return prev.map((x) => (String(x.product) === String(p._id) ? { ...x, cantidad: x.cantidad + 1 } : x));
      return [...prev, { product: p._id, nombre: p.nombre, sku: p.sku, precio: p.precio, iva: p.iva, cantidad: 1 }];
    });
  }

  return (
    <Panel
      title="Productos disponibles"
      subtitle="Agrega productos al carrito y envía tu pedido a bodega."
      right={
        <button className="btn" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
      <div className="catalogGrid">
        {state.items.map((p) => (
          <div key={p._id} className="productCard">
            {p.imageUrl ? <img className="productImg" src={p.imageUrl} alt={p.nombre} /> : <div className="productImg placeholder" />}
            <div className="productMeta">
              <div className="productName">{p.nombre}</div>
              <div className="muted">
                {formatMoney(p.precio)} · stock <code>{p.stock}</code>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary" type="button" onClick={() => addToCart(p)} disabled={p.stock <= 0}>
                  Agregar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!state.loading && !state.items.length ? <p className="muted">Sin productos disponibles.</p> : null}
    </Panel>
  );
}

function CartPanel() {
  const [cart, setCart] = useState(() => loadCart());
  const [busy, setBusy] = useState({ loading: false, error: "", ok: "" });

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const total = useMemo(() => {
    let sum = 0;
    for (const it of cart) {
      const line = Number(it.precio || 0) * Number(it.cantidad || 0) * (1 + Number(it.iva || 0) / 100);
      sum += line;
    }
    return Math.round(sum * 100) / 100;
  }, [cart]);

  async function checkout() {
    try {
      setBusy({ loading: true, error: "", ok: "" });
      await api.post("/api/shop/orders", { items: cart.map((it) => ({ product: it.product, cantidad: it.cantidad })) });
      setCart([]);
      setBusy({ loading: false, error: "", ok: "Pedido enviado a bodega." });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo enviar el pedido.";
      setBusy({ loading: false, error: message, ok: "" });
    }
  }

  return (
    <Panel title="Carrito" subtitle="Revisa cantidades y envía el pedido a bodega.">
      {!cart.length ? <p className="muted">Tu carrito está vacío.</p> : null}
      {cart.length ? (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.map((it, idx) => (
                <tr key={it.product}>
                  <td>
                    {it.nombre} <span className="muted">({it.sku})</span>
                  </td>
                  <td style={{ width: 160 }}>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={it.cantidad}
                      onChange={(e) =>
                        setCart((s) => s.map((x, i) => (i === idx ? { ...x, cantidad: Number(e.target.value) } : x)))
                      }
                    />
                  </td>
                  <td>{formatMoney(it.precio)}</td>
                  <td style={{ width: 120 }}>
                    <button className="btn" type="button" onClick={() => setCart((s) => s.filter((x) => x.product !== it.product))}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{ textAlign: "right", fontWeight: 800 }}>
                  Total: {formatMoney(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" type="button" onClick={checkout} disabled={!cart.length || busy.loading}>
          {busy.loading ? "Enviando…" : "Enviar pedido"}
        </button>
        <button className="btn" type="button" onClick={() => setCart([])} disabled={!cart.length || busy.loading}>
          Vaciar
        </button>
      </div>
      {busy.error ? <p className="bad">ERROR: {busy.error}</p> : null}
      {busy.ok ? <p className="ok">{busy.ok}</p> : null}
    </Panel>
  );
}

function CustomerOrdersPanel() {
  const [state, setState] = useState({ loading: false, items: [], error: "" });

  async function load() {
    try {
      setState({ loading: true, items: [], error: "" });
      const { data } = await api.get("/api/shop/orders");
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar pedidos.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Panel
      title="Mis pedidos"
      subtitle="Pedidos enviados a bodega y su estado."
      right={
        <button className="btn" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((o) => (
              <tr key={o._id}>
                <td>{o.numeroPedido ?? "—"}</td>
                <td>
                  <span className={`pill ${o.estado === "Despachado" || o.estado === "Facturado" ? "ok" : "warn"}`}>{o.estado}</span>
                </td>
                <td>{formatMoney(o.total)}</td>
                <td>{Array.isArray(o.items) ? o.items.length : 0}</td>
              </tr>
            ))}
            {!state.loading && !state.items.length ? (
              <tr>
                <td colSpan={4} className="muted">
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

function useProductsMeta() {
  const [meta, setMeta] = useState({ loading: false, categories: [], subCategories: [], barcodes: [], error: "" });

  async function load() {
    try {
      setMeta((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/products/meta");
      setMeta({
        loading: false,
        categories: Array.isArray(data?.categories) ? data.categories : [],
        subCategories: Array.isArray(data?.subCategories) ? data.subCategories : [],
        barcodes: Array.isArray(data?.barcodes) ? data.barcodes : [],
        error: ""
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar meta.";
      setMeta({ loading: false, categories: [], subCategories: [], barcodes: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { meta, reload: load };
}

function SearchArticlesPanel() {
  const { meta } = useProductsMeta();
  const [filters, setFilters] = useState({
    codigo: "",
    descripcion: "",
    categoria: "",
    subCategoria: "",
    referencia: "",
    codigoBarras: ""
  });
  const [state, setState] = useState({ loading: false, items: [], error: "" });

  async function search(e) {
    e?.preventDefault?.();
    try {
      setState({ loading: true, items: [], error: "" });
      const { data } = await api.get("/api/products", { params: filters });
      setState({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo buscar.";
      setState({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    search();
  }, []);

  return (
    <Panel title="Buscar Artículos" subtitle="Filtra por código, descripción, categorías, referencia o código de barras.">
      <form onSubmit={search} className="card">
        <div className="grid2">
          <div>
            <div className="muted">Código</div>
            <input className="input" value={filters.codigo} onChange={(e) => setFilters((s) => ({ ...s, codigo: e.target.value }))} />
          </div>
          <div>
            <div className="muted">Descripción</div>
            <input className="input" value={filters.descripcion} onChange={(e) => setFilters((s) => ({ ...s, descripcion: e.target.value }))} />
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <div className="muted">Categoría</div>
            <select className="input" value={filters.categoria} onChange={(e) => setFilters((s) => ({ ...s, categoria: e.target.value, subCategoria: "" }))}>
              <option value="">Seleccionar…</option>
              {meta.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="muted">SubCategoría</div>
            <select className="input" value={filters.subCategoria} onChange={(e) => setFilters((s) => ({ ...s, subCategoria: e.target.value }))}>
              <option value="">Seleccionar…</option>
              {meta.subCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <div className="muted">Referencia</div>
            <input className="input" value={filters.referencia} onChange={(e) => setFilters((s) => ({ ...s, referencia: e.target.value }))} />
          </div>
          <div>
            <div className="muted">Código barras</div>
            <select className="input" value={filters.codigoBarras} onChange={(e) => setFilters((s) => ({ ...s, codigoBarras: e.target.value }))}>
              <option value="">Seleccionar…</option>
              {meta.barcodes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={state.loading} type="submit">
            {state.loading ? "Buscando…" : "Buscar"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              setFilters({ codigo: "", descripcion: "", categoria: "", subCategoria: "", referencia: "", codigoBarras: "" })
            }
          >
            Limpiar
          </button>
        </div>
      </form>

      {state.error ? <p className="bad">ERROR: {state.error}</p> : null}
      <div className="tableWrap" style={{ marginTop: 14 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>SubCategoría</th>
              <th>Referencia</th>
              <th>Código barras</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((p) => (
              <tr key={p._id}>
                <td>
                  <code>{p.sku}</code>
                </td>
                <td>{p.descripcion || p.nombre}</td>
                <td>{p.categoria || "—"}</td>
                <td>{p.subCategoria || "—"}</td>
                <td>{p.referencia || "—"}</td>
                <td>{p.codigoBarras || "—"}</td>
                <td>{p.stock}</td>
              </tr>
            ))}
            {!state.loading && !state.items.length ? (
              <tr>
                <td colSpan={7} className="muted">
                  Sin resultados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CatalogPanel() {
  const apiBase = import.meta?.env?.VITE_API_URL || "";
  const { meta } = useProductsMeta();
  const [filters, setFilters] = useState({
    codigo: "",
    descripcion: "",
    categoria: "",
    subCategoria: "",
    referencia: "",
    codigoBarras: ""
  });

  function downloadPdf() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (String(v || "").trim()) params.set(k, String(v).trim());
    }
    const url = `${apiBase}/api/products/catalog.pdf?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Panel title="Catálogo" subtitle="Filtra y descarga el catálogo en PDF.">
      <div className="card">
        <div className="grid2">
          <div>
            <div className="muted">Código</div>
            <input className="input" value={filters.codigo} onChange={(e) => setFilters((s) => ({ ...s, codigo: e.target.value }))} />
          </div>
          <div>
            <div className="muted">Descripción</div>
            <input
              className="input"
              value={filters.descripcion}
              onChange={(e) => setFilters((s) => ({ ...s, descripcion: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <div className="muted">Categoría</div>
            <select className="input" value={filters.categoria} onChange={(e) => setFilters((s) => ({ ...s, categoria: e.target.value, subCategoria: "" }))}>
              <option value="">Seleccionar…</option>
              {meta.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="muted">SubCategoría</div>
            <select className="input" value={filters.subCategoria} onChange={(e) => setFilters((s) => ({ ...s, subCategoria: e.target.value }))}>
              <option value="">Seleccionar…</option>
              {meta.subCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <div className="muted">Referencia</div>
            <input className="input" value={filters.referencia} onChange={(e) => setFilters((s) => ({ ...s, referencia: e.target.value }))} />
          </div>
          <div>
            <div className="muted">Código barras</div>
            <select className="input" value={filters.codigoBarras} onChange={(e) => setFilters((s) => ({ ...s, codigoBarras: e.target.value }))}>
              <option value="">Seleccionar…</option>
              {meta.barcodes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <div className="row">
            <button className="btn primary" type="button" onClick={downloadPdf}>
              Descargar PDF
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                setFilters({ codigo: "", descripcion: "", categoria: "", subCategoria: "", referencia: "", codigoBarras: "" })
              }
            >
              Limpiar
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            El PDF se genera en el backend.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function ReportsPanel() {
  const [summary, setSummary] = useState({ loading: false, data: null, error: "" });
  const [byVendor, setByVendor] = useState({ loading: false, items: [], error: "" });
  const [byProduct, setByProduct] = useState({ loading: false, items: [], error: "" });
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { from: fmt(from), to: fmt(to) };
  });

  async function load() {
    try {
      setSummary({ loading: true, data: null, error: "" });
      setByVendor({ loading: true, items: [], error: "" });
      setByProduct({ loading: true, items: [], error: "" });
      const params = { from: range.from, to: range.to };
      const [a, b, c] = await Promise.all([
        api.get("/api/reports/sales/summary", { params }),
        api.get("/api/reports/sales/by-vendor", { params }),
        api.get("/api/reports/profit/by-product", { params })
      ]);
      setSummary({ loading: false, data: a.data, error: "" });
      setByVendor({ loading: false, items: Array.isArray(b.data?.items) ? b.data.items : [], error: "" });
      setByProduct({ loading: false, items: Array.isArray(c.data?.items) ? c.data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar reportes.";
      setSummary({ loading: false, data: null, error: message });
      setByVendor({ loading: false, items: [], error: message });
      setByProduct({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Panel
      title="Reportes"
      subtitle="Ventas y rentabilidad (según facturas emitidas) en el rango seleccionado."
      right={
        <button className="btn" type="button" onClick={load} disabled={summary.loading || byVendor.loading}>
          {summary.loading || byVendor.loading ? "Cargando…" : "Refrescar"}
        </button>
      }
    >
      {summary.error ? <p className="bad">ERROR: {summary.error}</p> : null}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="cardTitle" style={{ margin: 0 }}>
            Rango de fechas
          </div>
          <button className="btn" type="button" onClick={load}>
            Aplicar
          </button>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <div className="muted">Desde</div>
            <input className="input" type="date" value={range.from} onChange={(e) => setRange((s) => ({ ...s, from: e.target.value }))} />
          </div>
          <div>
            <div className="muted">Hasta</div>
            <input className="input" type="date" value={range.to} onChange={(e) => setRange((s) => ({ ...s, to: e.target.value }))} />
          </div>
        </div>
      </div>
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
            <div className="kpi">
              <div className="kpiLabel">Costo</div>
              <div className="kpiValue">{summary.data ? formatMoney(summary.data.totalCost) : "—"}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Utilidad</div>
              <div className="kpiValue">
                {summary.data ? (
                  <>
                    {formatMoney(summary.data.grossProfit)} <span className="muted">· {summary.data.margin}%</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
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
                  <th>Utilidad</th>
                </tr>
              </thead>
              <tbody>
                {byVendor.items.map((r) => (
                  <tr key={r.vendedorId}>
                    <td>{r.vendedor?.nombre || r.vendedor?.email || r.vendedorId}</td>
                    <td>{r.invoices}</td>
                    <td>{formatMoney(r.totalSales)}</td>
                    <td>
                      {formatMoney(r.grossProfit)} <span className="muted">({r.margin}%)</span>
                    </td>
                  </tr>
                ))}
                {!byVendor.loading && !byVendor.items.length ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Sin datos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardTitle">Rentabilidad por producto</div>
        <div className="tableWrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Qty</th>
                <th>Ventas</th>
                <th>Costo</th>
                <th>Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.items.map((r) => (
                <tr key={r.productId}>
                  <td>
                    {r.nombre} <span className="muted">({r.sku})</span>
                  </td>
                  <td>{r.qty}</td>
                  <td>{formatMoney(r.totalSales)}</td>
                  <td>{formatMoney(r.totalCost)}</td>
                  <td>
                    {formatMoney(r.grossProfit)} <span className="muted">({r.margin}%)</span>
                  </td>
                </tr>
              ))}
              {!byProduct.loading && !byProduct.items.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Sin datos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
              <option value="Cliente">Cliente</option>
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
