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
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    role: "Admin",
    nombre: ""
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [orderId, setOrderId] = useState("");
  const [lastDispatch, setLastDispatch] = useState(null);

  const authHeaderPreview = useMemo(() => (token ? `Bearer ${token.slice(0, 18)}…` : "(sin token)"), [token]);

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

  function persistToken(next) {
    const value = String(next || "");
    if (value) localStorage.setItem("token", value);
    else localStorage.removeItem("token");
    setToken(value);
  }

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
      </section>
    </div>
  );
}
