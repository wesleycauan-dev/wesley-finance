import { AnimatePresence } from "framer-motion";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Modal, { ErrorMsg, Field } from "./Modal";

export default function DataRights() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setErr("");
    try {
      const data = await api("/privacy/export");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      a.download = "wesley-finance-meus-dados.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/privacy/account", {
        method: "DELETE",
        body: { password: pw },
      });
      await logout();
      nav("/entrar");
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="h-lgpd" style={{ marginTop: "2.5rem" }}>
      <h2 id="h-lgpd">Seus dados (LGPD)</h2>
      <p className="muted">
        Você pode baixar uma cópia de tudo o que guardamos sobre você ou excluir
        sua conta.
      </p>
      {err && !open && <ErrorMsg msg={err} />}
      <div className="actions left">
        <button className="btn" onClick={exportData}>
          Baixar meus dados
        </button>
        {user?.role !== "owner" && (
          <button
            className="btn ghost"
            onClick={() => {
              setOpen(true);
              setErr("");
            }}
          >
            Excluir minha conta
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Excluir conta" onClose={() => setOpen(false)}>
            <form onSubmit={remove}>
              <p>
                Seus lançamentos, categorias, metas e preferências serão
                apagados e não poderão ser recuperados. Se houver assinatura,
                ela será cancelada. Registros de pagamento são mantidos sem
                identificação direta, por obrigação legal.
              </p>
              <Field label="Confirme com sua senha">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </Field>
              {err && <ErrorMsg msg={err} />}
              <div className="actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>
                <button className="btn primary" disabled={busy}>
                  {busy ? "Excluindo…" : "Excluir definitivamente"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
}
