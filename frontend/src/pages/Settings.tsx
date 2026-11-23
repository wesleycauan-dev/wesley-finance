import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import DataRights from "../components/DataRights";
import { ErrorMsg, Field } from "../components/Modal";
import { applyTheme, DEFAULT_PREFS, type Prefs } from "../theme";
import { contrast, readable } from "../utils";

export default function Settings() {
  const { user, reload } = useAuth();
  const [p, setP] = useState<Prefs>(user!.preferences);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const change = (n: Prefs) => {
    setP(n);
    setSaved(false);
    applyTheme(n);
  }; // pré-visualização ao vivo
  const bg = p.theme === "light" ? "#F4F8FF" : p.backgroundColor;
  const ratio = contrast(p.primaryColor, bg);
  const low = ratio < 3;
  const save = async () => {
    setErr("");
    try {
      await api("/preferences", { method: "PUT", body: p });
      await reload();
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <>
      <header className="page-head">
        <h1>Minha conta</h1>
      </header>
      <p className="muted">
        Escolha o tema e as cores da sua conta. A mudança aparece na hora e só
        vale para você.
      </p>
      <div className="settings">
        <Field label="Tema">
          <select
            value={p.theme}
            onChange={(e) =>
              change({ ...p, theme: e.target.value as Prefs["theme"] })
            }
          >
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
            <option value="system">Igual ao sistema</option>
          </select>
        </Field>
        <Field label="Cor de destaque">
          <input
            type="color"
            value={p.primaryColor}
            onChange={(e) =>
              change({ ...p, primaryColor: e.target.value.toUpperCase() })
            }
          />
        </Field>
        <Field label="Cor de fundo (tema escuro)">
          <input
            type="color"
            value={p.backgroundColor}
            onChange={(e) =>
              change({ ...p, backgroundColor: e.target.value.toUpperCase() })
            }
          />
        </Field>
      </div>
      <p role="status" className={low ? "error" : "muted"}>
        Contraste entre destaque e fundo: {ratio.toFixed(1)}:1.{" "}
        {low
          ? "Muito baixo: escolha cores mais distintas para manter a leitura confortável."
          : "Bom para leitura."}
      </p>
      <div className="preview">
        <button className="btn primary" type="button">
          Botão de exemplo
        </button>
        <span style={{ color: p.primaryColor }}>Texto em destaque</span>
        <span className="muted">Texto secundário</span>
        <i hidden>{readable(bg)}</i>
      </div>
      {err && <ErrorMsg msg={err} />}
      <div className="actions left">
        <button className="btn primary" onClick={save} disabled={low}>
          Salvar aparência
        </button>
        <button className="btn ghost" onClick={() => change(DEFAULT_PREFS)}>
          Restaurar azul e preto
        </button>
        {saved && <span role="status">Aparência salva.</span>}
      </div>
      <DataRights />
    </>
  );
}
