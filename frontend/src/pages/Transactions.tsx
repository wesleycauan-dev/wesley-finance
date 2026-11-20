import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import Modal, { ErrorMsg, Field } from "../components/Modal";
import { brl, fmtDate, fromCents, toCents, today } from "../utils";

interface Cat {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
}
interface Tx {
  id: string;
  type: "income" | "expense";
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  description: string;
  amountCents: number;
  occurredOn: string;
  notes: string | null;
}
interface List {
  data: Tx[];
  page: number;
  limit: number;
  total: number;
}

function TxForm({
  tx,
  cats,
  onDone,
  onClose,
}: {
  tx: Tx | null;
  cats: Cat[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    type: tx?.type ?? "expense",
    categoryId: tx?.categoryId ?? "",
    description: tx?.description ?? "",
    amount: tx ? fromCents(tx.amountCents) : "",
    occurredOn: tx?.occurredOn ?? today(),
    notes: tx?.notes ?? "",
  });
  const [err, setErr] = useState("");
  const options = cats.filter((c) => c.type === f.type);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    const amountCents = toCents(f.amount);
    if (Number.isNaN(amountCents))
      return setErr("Informe um valor maior que zero, por exemplo 25,90.");
    try {
      await api(tx ? `/transactions/${tx.id}` : "/transactions", {
        method: tx ? "PUT" : "POST",
        body: {
          type: f.type,
          categoryId: f.categoryId,
          description: f.description,
          amountCents,
          occurredOn: f.occurredOn,
          notes: f.notes || undefined,
        },
      });
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Modal
      title={tx ? "Editar lançamento" : "Novo lançamento"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Tipo">
          <select
            value={f.type}
            onChange={(e) =>
              setF({ ...f, type: e.target.value as Tx["type"], categoryId: "" })
            }
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </Field>
        <Field label="Categoria">
          <select
            required
            value={f.categoryId}
            onChange={(e) => setF({ ...f, categoryId: e.target.value })}
          >
            <option value="" disabled>
              Selecione
            </option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input
            required
            maxLength={160}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </Field>
        <div className="row">
          <Field label="Valor (R$)">
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={f.amount}
              onChange={(e) => setF({ ...f, amount: e.target.value })}
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              required
              value={f.occurredOn}
              onChange={(e) => setF({ ...f, occurredOn: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Observações (opcional)">
          <input
            maxLength={500}
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
        </Field>
        {err && <ErrorMsg msg={err} />}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">Salvar lançamento</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Transactions() {
  const [list, setList] = useState<List | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [q, setQ] = useState({ type: "", from: "", to: "", page: 1 });
  const [editing, setEditing] = useState<Tx | "new" | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(q.page), limit: "15" });
    (["type", "from", "to"] as const).forEach((k) => q[k] && p.set(k, q[k]));
    api<List>(`/transactions?${p}`)
      .then(setList)
      .catch((e) => setErr(e.message));
  }, [q]);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ data: Cat[] }>("/categories")
      .then((r) => setCats(r.data))
      .catch((e) => setErr(e.message));
  }, []);

  const remove = async (t: Tx) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    try {
      await api(`/transactions/${t.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const pages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;

  return (
    <>
      <header className="page-head">
        <h1>Lançamentos</h1>
        <button className="btn primary" onClick={() => setEditing("new")}>
          Novo lançamento
        </button>
      </header>
      <div className="filters">
        <Field label="Tipo">
          <select
            value={q.type}
            onChange={(e) => setQ({ ...q, type: e.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
        </Field>
        <Field label="De">
          <input
            type="date"
            value={q.from}
            onChange={(e) => setQ({ ...q, from: e.target.value, page: 1 })}
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            value={q.to}
            onChange={(e) => setQ({ ...q, to: e.target.value, page: 1 })}
          />
        </Field>
      </div>
      {err && <ErrorMsg msg={err} />}
      {list && list.data.length === 0 && (
        <p className="muted">
          Nenhum lançamento encontrado. Use “Novo lançamento” para registrar sua
          primeira receita ou despesa.
        </p>
      )}
      {list && list.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th className="num">Valor</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.data.map((t) => (
                  <motion.tr
                    key={t.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td>{fmtDate(t.occurredOn)}</td>
                    <td>{t.description}</td>
                    <td>
                      <i
                        className="dot"
                        style={{ background: t.categoryColor }}
                        aria-hidden="true"
                      />
                      {t.categoryName}
                    </td>
                    <td
                      className="num"
                      style={{
                        color: t.type === "expense" ? "#FF6B6B" : undefined,
                      }}
                    >
                      {t.type === "expense" ? "−" : "+"} {brl(t.amountCents)}
                      <span className="sr-only">
                        {t.type === "expense" ? " (despesa)" : " (receita)"}
                      </span>
                    </td>
                    <td className="acts">
                      <button
                        className="btn ghost"
                        onClick={() => setEditing(t)}
                        aria-label={`Editar ${t.description}`}
                      >
                        Editar
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => remove(t)}
                        aria-label={`Excluir ${t.description}`}
                      >
                        Excluir
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      {list && (
        <nav className="pager" aria-label="Paginação">
          <button
            className="btn ghost"
            disabled={q.page <= 1}
            onClick={() => setQ({ ...q, page: q.page - 1 })}
          >
            Anterior
          </button>
          <span>
            Página {q.page} de {pages}
          </span>
          <button
            className="btn ghost"
            disabled={q.page >= pages}
            onClick={() => setQ({ ...q, page: q.page + 1 })}
          >
            Próxima
          </button>
        </nav>
      )}
      <AnimatePresence>
        {editing && (
          <TxForm
            tx={editing === "new" ? null : editing}
            cats={cats}
            onClose={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
