import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Billing from "./pages/Billing";
import Categories from "./pages/Categories";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import Privacy from "./pages/Privacy";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";

function Protected({ access }: { access?: boolean }) {
  const { user } = useAuth();
  if (user === undefined)
    return (
      <p className="center" role="status">
        Carregando…
      </p>
    );
  if (!user) return <Navigate to="/entrar" replace />;
  if (access && !user.hasAccess) return <Navigate to="/assinatura" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Auth mode="login" />} />
      <Route path="/cadastro" element={<Auth mode="register" />} />
      <Route path="/privacidade" element={<Privacy />} />
      <Route element={<Protected access />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lancamentos" element={<Transactions />} />
        <Route path="/categorias" element={<Categories />} />
        <Route path="/metas" element={<Goals />} />
      </Route>
      <Route element={<Protected />}>
        <Route path="/assinatura" element={<Billing />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Route>
      <Route
        path="/assinatura/retorno"
        element={<Navigate to="/assinatura" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
