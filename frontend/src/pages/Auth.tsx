import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ErrorMsg, Field } from "../components/Modal";

export default function Auth({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    terms: false,
  });
  const reg = mode === "register";
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (reg)
        await register({ name: f.name, email: f.email, password: f.password });
      else await login(f.email, f.password);
      nav("/");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        aria-labelledby="t"
      >
        <div className="brand">
          <img src="public/favicon.svg" alt="Logo" width={28} height={28} />
          Wesley Finance
        </div>
        <h1 id="t">{reg ? "Crie sua conta" : "Entre na sua conta"}</h1>
        {reg && (
          <Field label="Nome">
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
        )}
        <Field label="E-mail">
          <input
            type="email"
            required
            autoComplete="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            required
            autoComplete={reg ? "new-password" : "current-password"}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            aria-describedby={reg ? "hint" : undefined}
          />
        </Field>
        {reg && (
          <p id="hint" className="muted small">
            Mínimo de 10 caracteres, com letra maiúscula, minúscula e número.
          </p>
        )}
        {reg && (
          <label className="check">
            <input
              type="checkbox"
              required
              checked={f.terms}
              onChange={(e) => setF({ ...f, terms: e.target.checked })}
            />{" "}
            Li e aceito a{" "}
            <Link to="/privacidade" target="_blank">
              Política de Privacidade
            </Link>{" "}
            e os termos de uso.
          </label>
        )}
        {err && <ErrorMsg msg={err} />}
        <button className="btn primary" disabled={busy}>
          {busy ? "Aguarde…" : reg ? "Criar conta" : "Entrar"}
        </button>
        <p className="muted small">
          {reg ? (
            <>
              Já tem conta? <Link to="/entrar">Entrar</Link>
            </>
          ) : (
            <>
              Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
            </>
          )}
        </p>
      </motion.form>
    </div>
  );
}
