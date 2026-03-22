import { useState } from "react";
import { api } from "../lib/api";

/**
 * Botón para Bodega: prepara y despacha un pedido.
 * Llama PATCH /api/orders/:id/dispatch y devuelve la orden actualizada.
 */
export default function DispatchOrderButton({ orderId, disabled, onDispatched }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDispatch() {
    try {
      setError("");
      setLoading(true);
      const { data } = await api.patch(`/api/orders/${orderId}/dispatch`);
      onDispatched?.(data.order);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo despachar el pedido.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDispatch}
        disabled={disabled || loading}
        className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Despachando..." : "Preparar y Despachar"}
      </button>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

