import { motion } from "framer-motion";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

const links = [
  { to: "/", label: "Resumo", end: true, access: true },
  { to: "/lancamentos", label: "Lançamentos", access: true },
  { to: "/categorias", label: "Categorias", access: true },
  { to: "/metas", label: "Metas", access: true },
  { to: "/assinatura", label: "Assinatura" },
  { to: "/configuracoes", label: "Aparência" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  return (
    <div className="shell">
      <a href="#conteudo" className="skip">
        Pular para o conteúdo
      </a>
      <aside className="side">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          Wesley Finance
        </div>
        <nav aria-label="Principal">
          {links
            .filter((l) => !l.access || user?.hasAccess)
            .map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ))}
        </nav>
        <div className="who">
          <span>{user?.name}</span>
          <button className="btn ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <motion.main
        id="conteudo"
        key={pathname}
        tabIndex={-1}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Outlet />
      </motion.main>
    </div>
  );
}
