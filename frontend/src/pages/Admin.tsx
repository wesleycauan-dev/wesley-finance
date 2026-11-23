import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { ErrorMsg, Field } from "../components/Modal";
import { brl, fmtDate } from "../utils";

interface Overview {
  users: number;
  newUsers30: number;
  active: number;
  pending: number;
  pastDue: number;
  cancelled: number;
  mrrCents: number;
  revenue30Cents: number;
  revenueTotalCents: number;
}
interface U {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  status: string;
  currentPeriodEnd: string | null;
}
interface P {
  id: string;
  email: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}
const SUB: Record<string, string> = {
  none: "Sem assinatura",
  pending: "Pendente",
  active: "Ativa",
  past_due: "Em atraso",
  cancelled: "Cancelada",
};
const PAY: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  rejected: "Recusado",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};
type Tab = "overview" | "users" | "payments";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [err, setErr] = useState("");
  const [ov, setOv] = useState<Overview | null>(null);
  const [users, setUsers] = useState<{
    data: U[];
    total: number;
    limit: number;
  } | null>(null);
  const [f, setF] = useState({ search: "", status: "", page: 1 });
  const [draft, setDraft] = useState("");
  const [pays, setPays] = useState<P[]>([]);

  const loadUsers = useCallback(() => {
    const p = new URLSearchParams({ page: String(f.page), limit: "20" });
    if (f.search) p.set("search", f.search);
    if (f.status) p.set("status", f.status);
    api<{ data: U[]; total: number; limit: number }>(`/admin/users?${p}`)
      .then(setUsers)
      .catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    setErr("");
    if (tab === "overview")
      api<Overview>("/admin/overview")
        .then(setOv)
        .catch((e) => setErr(e.message));
    if (tab === "payments")
      api<{ data: P[] }>("/admin/payments?limit=50")
        .then((r) => setPays(r.data))
        .catch((e) => setErr(e.message));
  }, [tab]);
  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab, loadUsers]);

  const toggle = async (u: U) => {
    if (
      !confirm(
        u.isActive
          ? `Bloquear ${u.email}? O acesso será encerrado imediatamente.`
          : `Desbloquear ${u.email}?`,
      )
    )
      return;
    try {
      await api(`/admin/users/${u.id}/active`, {
        method: "PATCH",
        body: { isActive: !u.isActive },
      });
      loadUsers();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const search = (e: FormEvent) => {
    e.preventDefault();
    setF({ ...f, search: draft.trim(), page: 1 });
  };
  const pages = users ? Math.max(1, Math.ceil(users.total / users.limit)) : 1;

  return (
    <>
      <header className="page-head">
        <h1>Administração</h1>
        <div className="actions" role="group" aria-label="Seções">
          {(["overview", "users", "payments"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`btn ${tab === t ? "primary" : "ghost"}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {
                {
                  overview: "Visão geral",
                  users: "Usuários",
                  payments: "Pagamentos",
                }[t]
              }
            </button>
          ))}
        </div>
      </header>
      {err && <ErrorMsg msg={err} />}
      {tab === "overview" && ov && (
        <>
          <section className="stats" aria-label="Indicadores">
            <div>
              <span className="muted">Receita mensal recorrente</span>
              <strong className="big">{brl(ov.mrrCents)}</strong>
            </div>
            <div>
              <span className="muted">Assinantes ativos</span>
              <strong>{ov.active}</strong>
            </div>
            <div>
              <span className="muted">Usuários</span>
              <strong>
                {ov.users} ({ov.newUsers30} nos últimos 30 dias)
              </strong>
            </div>
            <div>
              <span className="muted">Recebido em 30 dias</span>
              <strong>{brl(ov.revenue30Cents)}</strong>
            </div>
          </section>
          <p>
            Pendentes: <strong>{ov.pending}</strong> · Em atraso:{" "}
            <strong>{ov.pastDue}</strong> · Canceladas:{" "}
            <strong>{ov.cancelled}</strong> · Total recebido:{" "}
            <strong>{brl(ov.revenueTotalCents)}</strong>
          </p>
          <p className="muted small">
            Por privacidade, o painel não mostra os lançamentos financeiros dos
            usuários.
          </p>
        </>
      )}
      {tab === "users" && (
        <>
          <form className="filters" onSubmit={search}>
            <Field label="Buscar por nome ou e-mail">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} />
            </Field>
            <Field label="Assinatura">
              <select
                value={f.status}
                onChange={(e) =>
                  setF({ ...f, status: e.target.value, page: 1 })
                }
              >
                <option value="">Todas</option>
                {Object.entries(SUB).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn" style={{ alignSelf: "center" }}>
              Buscar
            </button>
          </form>
          {users && users.data.length === 0 && (
            <p className="muted">
              Nenhum usuário encontrado com esses filtros.
            </p>
          )}
          {users && users.data.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Assinatura</th>
                    <th>Cadastro</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.role === "owner"
                          ? "Vitalícia (proprietário)"
                          : SUB[u.status]}
                      </td>
                      <td>{fmtDate(u.createdAt.slice(0, 10))}</td>
                      <td>{u.isActive ? "Ativo" : "Bloqueado"}</td>
                      <td className="acts">
                        {u.role !== "owner" && (
                          <button
                            className="btn ghost"
                            onClick={() => toggle(u)}
                            aria-label={`${u.isActive ? "Bloquear" : "Desbloquear"} ${u.email}`}
                          >
                            {u.isActive ? "Bloquear" : "Desbloquear"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="pager" aria-label="Paginação">
            <button
              className="btn ghost"
              disabled={f.page <= 1}
              onClick={() => setF({ ...f, page: f.page - 1 })}
            >
              Anterior
            </button>
            <span>
              Página {f.page} de {pages}
            </span>
            <button
              className="btn ghost"
              disabled={f.page >= pages}
              onClick={() => setF({ ...f, page: f.page + 1 })}
            >
              Próxima
            </button>
          </nav>
        </>
      )}
      {tab === "payments" &&
        (pays.length === 0 ? (
          <p className="muted">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Usuário</th>
                  <th>Situação</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate((p.paidAt ?? p.createdAt).slice(0, 10))}</td>
                    <td>{p.email}</td>
                    <td>{PAY[p.status] ?? p.status}</td>
                    <td className="num">{brl(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
