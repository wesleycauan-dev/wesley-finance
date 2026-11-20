import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import Modal, { ErrorMsg, Field } from "../components/Modal";
import { brl, fmtDate, fromCents, toCents } from "../utils";

interface Goal {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
  status: "active" | "completed" | "cancelled";
}
type Mode = { kind: "edit"; goal: Goal | null } | { kind: "add"; goal: Goal };

function GoalModal({
  mode,
  onDone,
  onClose,
}: {
  mode: Mode;
  onDone: () => void;
  onClose: () => void;
}) {
  const g = mode.goal;
  const add = mode.kind === "add";
  const [f, setF] = useState({
    name: g?.name ?? "",
    target: g ? fromCents(g.targetCents) : "",
    deadline: g?.deadline ?? "",
    amount: "",
  });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    const value = toCents(add ? f.amount : f.target);
    if (Number.isNaN(value))
      return setErr("Informe um valor maior que zero, por exemplo 150,00.");
    try {
      if (add)
        await api(`/goals/${mode.goal.id}/contributions`, {
          method: "POST",
          body: { amountCents: value },
        });
      else
        await api(g ? `/goals/${g.id}` : "/goals", {
          method: g ? "PUT" : "POST",
          body: {
            name: f.name,
            targetCents: value,
            deadline: f.deadline || null,
          },
        });
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Modal
      title={
        add
          ? `Adicionar à meta “${mode.goal?.name}”`
          : g
            ? "Editar meta"
            : "Nova meta"
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {add ? (
          <Field label="Valor do aporte (R$)">
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={f.amount}
              onChange={(e) => setF({ ...f, amount: e.target.value })}
            />
          </Field>
        ) : (
          <>
            <Field label="Nome da meta">
              <input
                required
                maxLength={120}
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Valor alvo (R$)">
              <input
                required
                inputMode="decimal"
                placeholder="0,00"
                value={f.target}
                onChange={(e) => setF({ ...f, target: e.target.value })}
              />
            </Field>
            <Field label="Prazo (opcional)">
              <input
                type="date"
                value={f.deadline}
                onChange={(e) => setF({ ...f, deadline: e.target.value })}
              />
            </Field>
          </>
        )}
        {err && <ErrorMsg msg={err} />}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">
            {add ? "Adicionar valor" : "Salvar meta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api<{ data: Goal[] }>("/goals")
      .then((r) => setGoals(r.data))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);
  const remove = async (g: Goal) => {
    if (!confirm(`Excluir a meta "${g.name}"?`)) return;
    try {
      await api(`/goals/${g.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <>
      <header className="page-head">
        <h1>Metas</h1>
        <button
          className="btn primary"
          onClick={() => setMode({ kind: "edit", goal: null })}
        >
          Nova meta
        </button>
      </header>
      {err && <ErrorMsg msg={err} />}
      {goals.length === 0 && (
        <p className="muted">
          Você ainda não tem metas. Crie uma para acompanhar quanto falta para
          chegar lá.
        </p>
      )}
      <ul className="plain goals">
        {goals.map((g) => {
          const pct = Math.min(
            100,
            Math.round((g.currentCents / g.targetCents) * 100),
          );
          return (
            <li key={g.id}>
              <div className="goal-head">
                <h2>{g.name}</h2>
                <span className="muted">
                  {g.status === "completed"
                    ? "Concluída"
                    : g.deadline
                      ? `Prazo: ${fmtDate(g.deadline)}`
                      : ""}
                </span>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`Progresso da meta ${g.name}`}
              >
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p>
                {brl(g.currentCents)} de {brl(g.targetCents)} ({pct}%)
              </p>
              <div className="actions left">
                {g.status === "active" && (
                  <button
                    className="btn primary"
                    onClick={() => setMode({ kind: "add", goal: g })}
                  >
                    Adicionar valor
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => setMode({ kind: "edit", goal: g })}
                >
                  Editar
                </button>
                <button className="btn ghost" onClick={() => remove(g)}>
                  Excluir
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <AnimatePresence>
        {mode && (
          <GoalModal
            mode={mode}
            onClose={() => setMode(null)}
            onDone={() => {
              setMode(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
