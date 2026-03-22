import { useEffect, useMemo, useState } from "react";
import DispatchOrderButton from "./components/DispatchOrderButton.jsx";
import { api } from "./lib/api.js";

function getToken() {
  return localStorage.getItem("token") || "";
}

export default function App() {
  const [health, setHealth] = useState({ loading: true, ok: false, error: "" });
  const [token, setToken] = useState(getToken());
  const [auth, setAuth] = useState({ loading: false, error: "", user: null });
  const [catalog, setCatalog] = useState({ loading: false, items: [], error: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    role: "Admin",
    nombre: ""
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [orderId, setOrderId] = useState("");
  const [lastDispatch, setLastDispatch] = useState(null);
  const [imageUpload, setImageUpload] = useState({ productId: "", file: null, loading: false, error: "", ok: "" });

  const authHeaderPreview = useMemo(() => (token ? `Bearer ${token.slice(0, 18)}…` : "(sin token)"), [token]);
  const isAdmin = auth?.user?.role === "Admin";

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

  async function loadCatalog() {
    try {
      setCatalog((s) => ({ ...s, loading: true, error: "" }));
      const { data } = await api.get("/api/products");
      setCatalog({ loading: false, items: Array.isArray(data?.items) ? data.items : [], error: "" });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo cargar el catálogo.";
      setCatalog({ loading: false, items: [], error: message });
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  function persistToken(next) {
    const value = String(next || "");
    if (value) localStorage.setItem("token", value);
    else localStorage.removeItem("token");
    setToken(value);
  }

  useEffect(() => {
    if (!auth?.user) return;
    setImageUpload((s) => ({ ...s, productId: s.productId || "" }));
  }, [auth?.user]);

  async function onRegister(e) {
    e.preventDefault();
    try {
      setAuth({ loading: true, error: "", user: null });
      const { data } = await api.post("/api/auth/register", registerForm);
      persistToken(data?.token || "");
      setAuth({ loading: false, error: "", user: data?.user || null });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo registrar.";
      setAuth({ loading: false, error: message, user: null });
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    try {
      setAuth({ loading: true, error: "", user: null });
      const { data } = await api.post("/api/auth/login", loginForm);
      persistToken(data?.token || "");
      setAuth({ loading: false, error: "", user: data?.user || null });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "No se pudo iniciar sesión.";
      setAuth({ loading: false, error: message, user: null });
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
    <div className="page">
      <header className="card">
        <h1 className="title">SISTEGO — Local Test UI</h1>
        <p className="muted">
          Backend: <code>http://localhost:4000</code> (Vite hace proxy de <code>/api</code> y <code>/health</code>)
        </p>
        <p className="muted">
          Health:{" "}
          {health.loading ? (
            "verificando…"
          ) : health.ok ? (
            <span className="ok">OK</span>
          ) : (
            <span className="bad">ERROR: {health.error || "no responde"}</span>
          )}
        </p>
      </header>

      <section className="grid">
        <div className="card">
          <h2 className="subtitle">Token</h2>
          <p className="muted">
            Authorization: <code>{authHeaderPreview}</code>
          </p>
          <div className="row">
            <input
              className="input"
              placeholder="Pega tu JWT aquí (opcional)"
              value={token}
              onChange={(e) => persistToken(e.target.value)}
            />
            <button className="btn" type="button" onClick={() => persistToken("")}>
              Limpiar
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="subtitle">Registro</h2>
          <form onSubmit={onRegister} className="stack">
            <input
              className="input"
              placeholder="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm((s) => ({ ...s, email: e.target.value }))}
            />
            <input
              className="input"
              placeholder="password"
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((s) => ({ ...s, password: e.target.value }))}
            />
            <div className="row">
              <select
                className="input"
                value={registerForm.role}
                onChange={(e) => setRegisterForm((s) => ({ ...s, role: e.target.value }))}
              >
                <option value="Admin">Admin</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Bodega">Bodega</option>
              </select>
              <input
                className="input"
                placeholder="nombre (opcional)"
                value={registerForm.nombre}
                onChange={(e) => setRegisterForm((s) => ({ ...s, nombre: e.target.value }))}
              />
            </div>
            <button className="btn primary" disabled={auth.loading} type="submit">
              {auth.loading ? "Registrando…" : "Registrar"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="subtitle">Login</h2>
          <form onSubmit={onLogin} className="stack">
            <input
              className="input"
              placeholder="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm((s) => ({ ...s, email: e.target.value }))}
            />
            <input
              className="input"
              placeholder="password"
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((s) => ({ ...s, password: e.target.value }))}
            />
            <button className="btn primary" disabled={auth.loading} type="submit">
              {auth.loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
          {auth.error ? <p className="bad">ERROR: {auth.error}</p> : null}
          {auth.user ? (
            <p className="ok">
              Sesión: <code>{auth.user.email}</code> (<code>{auth.user.role}</code>)
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2 className="subtitle">Despacho</h2>
          <p className="muted">
            Requiere token con rol <code>Bodega</code> y un <code>orderId</code> existente.
          </p>
          <div className="row">
            <input
              className="input"
              placeholder="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <DispatchOrderButton
              orderId={orderId}
              disabled={!orderId}
              onDispatched={(order) => setLastDispatch(order)}
            />
          </div>
          {lastDispatch ? (
            <pre className="pre">{JSON.stringify(lastDispatch, null, 2)}</pre>
          ) : null}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="subtitle" style={{ margin: 0 }}>
              Catálogo
            </h2>
            <button className="btn" type="button" onClick={loadCatalog} disabled={catalog.loading}>
              {catalog.loading ? "Cargando…" : "Refrescar"}
            </button>
          </div>
          {catalog.error ? <p className="bad">ERROR: {catalog.error}</p> : null}
          {!catalog.loading && !catalog.items.length ? <p className="muted">Sin productos.</p> : null}
          <div className="catalogGrid" style={{ marginTop: 12 }}>
            {catalog.items.map((p) => (
              <div key={p._id} className="productCard">
                {p.imageUrl ? <img className="productImg" src={p.imageUrl} alt={p.nombre} /> : <div className="productImg placeholder" />}
                <div className="productMeta">
                  <div className="productName">{p.nombre}</div>
                  <div className="muted">
                    SKU: <code>{p.sku}</code>
                  </div>
                  <div className="muted">
                    Precio: <code>{p.precio}</code> · Stock: <code>{p.stock}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="subtitle">Foto de producto (Cloudinary)</h2>
          <p className="muted">
            Requiere token con rol <code>Admin</code>. Sube una imagen al producto seleccionado.
          </p>
          {!isAdmin ? <p className="muted">Inicia sesión como <code>Admin</code> para habilitar esta sección.</p> : null}
          <form onSubmit={onUploadProductImage} className="stack" style={{ opacity: isAdmin ? 1 : 0.6 }}>
            <select
              className="input"
              disabled={!isAdmin || imageUpload.loading}
              value={imageUpload.productId}
              onChange={(e) => setImageUpload((s) => ({ ...s, productId: e.target.value }))}
            >
              <option value="">Selecciona un producto…</option>
              {catalog.items.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.nombre} ({p.sku})
                </option>
              ))}
            </select>
            <input
              className="input"
              disabled={!isAdmin || imageUpload.loading}
              type="file"
              accept="image/*"
              onChange={(e) => setImageUpload((s) => ({ ...s, file: e.target.files?.[0] || null }))}
            />
            <button className="btn primary" disabled={!isAdmin || imageUpload.loading} type="submit">
              {imageUpload.loading ? "Subiendo…" : "Subir imagen"}
            </button>
          </form>
          {imageUpload.error ? <p className="bad">ERROR: {imageUpload.error}</p> : null}
          {imageUpload.ok ? <p className="ok">{imageUpload.ok}</p> : null}
        </div>
      </section>
    </div>
  );
}
