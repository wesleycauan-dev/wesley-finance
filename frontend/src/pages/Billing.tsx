import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorMsg } from "../components/Modal";
import { brl, fmtDate } from "../utils";

interface Status {
  status: string;
  currentPeriodEnd: string | null;
  priceCents: number;
  isOwner: boolean;
}
interface Payment {
  id: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}
const LABEL: Record<string, string> = {
  none: "Sem assinatura",
  pending: "Aguardando confirmação do pagamento",
  active: "Ativa",
  past_due: "Pagamento pendente",
  cancelled: "Cancelada",
};
const PAY: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  rejected: "Recusado",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

export default function Billing() {
  const { user, reload } = useAuth();
  const [st, setSt] = useState<Status | null>(null);
  const [pays, setPays] = useState<Payment[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const status = user!.subscription.status;

  const load = () => {
    api<Status>("/billing/status")
      .then(setSt)
      .catch((e) => setErr(e.message));
    api<{ data: Payment[] }>("/billing/payments")
      .then((r) => setPays(r.data))
      .catch(() => {});
  };
  useEffect(load, [status]);
  // Após pagar, a confirmação chega por webhook: consulta de tempos em tempos enquanto estiver pendente.
  useEffect(() => {
    if (status !== "pending") return;
    let n = 0;
    const id = setInterval(() => {
      reload();
      if (++n >= 24) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [status, reload]);

  const subscribe = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ checkoutUrl: string }>("/billing/checkout", {
        method: "POST",
      });
      window.location.assign(r.checkoutUrl);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (
      !confirm(
        "Cancelar a assinatura? Você mantém o acesso até o fim do período já pago.",
      )
    )
      return;
    try {
      await api("/billing/cancel", { method: "POST" });
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <header className="page-head">
        <h1>Assinatura</h1>
      </header>
      {err && <ErrorMsg msg={err} />}
      {st?.isOwner ? (
        <p>
          Você é o proprietário: acesso administrativo vitalício e gratuito.
        </p>
      ) : (
        st && (
          <section aria-labelledby="h-plan">
            <h2 id="h-plan">Plano mensal · {brl(st.priceCents)}/mês</h2>
            <p role="status">
              Situação: <strong>{LABEL[status] ?? status}</strong>
              {user!.subscription.currentPeriodEnd &&
                ["active", "cancelled"].includes(status) && (
                  <>
                    {" "}
                    · acesso até{" "}
                    {fmtDate(user!.subscription.currentPeriodEnd.slice(0, 10))}
                  </>
                )}
            </p>
            {!user!.hasAccess && (
              <p className="muted">
                Assine para liberar resumo, lançamentos, categorias e metas. O
                acesso é liberado assim que o Mercado Pago confirmar o
                pagamento.
              </p>
            )}
            <div className="actions left">
              {["none", "cancelled", "pending", "past_due"].includes(status) &&
                !user!.hasAccess && (
                  <button
                    className="btn primary"
                    onClick={subscribe}
                    disabled={busy}
                  >
                    {busy
                      ? "Abrindo o Mercado Pago…"
                      : "Assinar com Mercado Pago"}
                  </button>
                )}
              {status === "active" && (
                <button className="btn ghost" onClick={cancel}>
                  Cancelar assinatura
                </button>
              )}
            </div>
          </section>
        )
      )}
      <section aria-labelledby="h-hist">
        <h2 id="h-hist">Histórico de pagamentos</h2>
        {pays.length === 0 ? (
          <p className="muted">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Situação</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate((p.paidAt ?? p.createdAt).slice(0, 10))}</td>
                    <td>{PAY[p.status] ?? p.status}</td>
                    <td className="num">{brl(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
