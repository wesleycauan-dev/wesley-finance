import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import Modal, { ErrorMsg, Field } from "../components/Modal";

interface Cat {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
}

function CatForm({
  cat,
  onDone,
  onClose,
}: {
  cat: Cat | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: cat?.name ?? "",
    type: cat?.type ?? "expense",
    color: cat?.color ?? "#1E90FF",
  });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await api(cat ? `/categories/${cat.id}` : "/categories", {
        method: cat ? "PUT" : "POST",
        body: cat ? { name: f.name, color: f.color } : f,
      });
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Modal
      title={cat ? "Editar categoria" : "Nova categoria"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Nome">
          <input
            required
            maxLength={60}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        {!cat && (
          <Field label="Tipo">
            <select
              value={f.type}
              onChange={(e) =>
                setF({ ...f, type: e.target.value as Cat["type"] })
              }
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </Field>
        )}
        <Field label="Cor">
          <input
            type="color"
            value={f.color}
            onChange={(e) => setF({ ...f, color: e.target.value })}
          />
        </Field>
        {err && <ErrorMsg msg={err} />}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">Salvar categoria</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api<{ data: Cat[] }>("/categories")
      .then((r) => setCats(r.data))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);
  const remove = async (c: Cat) => {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try {
      await api(`/categories/${c.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const group = (type: Cat["type"], title: string) => (
    <section aria-labelledby={`h-${type}`}>
      <h2 id={`h-${type}`}>{title}</h2>
      <ul className="plain">
        {cats
          .filter((c) => c.type === type)
          .map((c) => (
            <li key={c.id}>
              <span>
                <i
                  className="dot"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                {c.name}
              </span>
              <span>
                <button
                  className="btn ghost"
                  onClick={() => setEditing(c)}
                  aria-label={`Editar ${c.name}`}
                >
                  Editar
                </button>
                <button
                  className="btn ghost"
                  onClick={() => remove(c)}
                  aria-label={`Excluir ${c.name}`}
                >
                  Excluir
                </button>
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
  return (
    <>
      <header className="page-head">
        <h1>Categorias</h1>
        <button className="btn primary" onClick={() => setEditing("new")}>
          Nova categoria
        </button>
      </header>
      {err && <ErrorMsg msg={err} />}
      <div className="grid2">
        {group("expense", "Despesas")}
        {group("income", "Receitas")}
      </div>
      <AnimatePresence>
        {editing && (
          <CatForm
            cat={editing === "new" ? null : editing}
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
