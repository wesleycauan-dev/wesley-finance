import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorMsg } from "../components/Modal";
import { brl } from "../utils";

interface Summary {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  expensesByCategory: { name: string; color: string; total: number }[];
  monthlySeries: { month: string; income: number; expense: number }[];
  goals: { active: number; completed: number };
}
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [s, setS] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Summary>(`/dashboard/summary?month=${month}`)
      .then(setS)
      .catch((e) => setErr(e.message));
  }, [month]);
  const primary = user!.preferences.primaryColor;
  const tick = { fill: "currentColor", fontSize: 12 };

  return (
    <>
      <header className="page-head">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {greeting()}, {user!.name.split(" ")[0]}
          </motion.h1>
          <p className="muted">Veja como está o seu mês.</p>
        </div>
        <label className="field inline">
          <span>Mês</span>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </header>
      {err && <ErrorMsg msg={err} />}
      {s && (
        <>
          <section className="stats" aria-label="Totais do mês">
            <div>
              <span className="muted">Saldo</span>
              <strong
                className="big"
                style={{ color: s.balanceCents < 0 ? "#FF6B6B" : undefined }}
              >
                {brl(s.balanceCents)}
              </strong>
            </div>
            <div>
              <span className="muted">Receitas</span>
              <strong>{brl(s.incomeCents)}</strong>
            </div>
            <div>
              <span className="muted">Despesas</span>
              <strong>{brl(s.expenseCents)}</strong>
            </div>
            <div>
              <span className="muted">Metas</span>
              <strong>
                {s.goals.active} ativas · {s.goals.completed} concluídas
              </strong>
            </div>
          </section>
          <div className="grid2">
            <section aria-labelledby="h-serie">
              <h2 id="h-serie">Últimos 6 meses</h2>
              <div className="chart">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={s.monthlySeries.map((m) => ({
                      ...m,
                      income: m.income / 100,
                      expense: m.expense / 100,
                    }))}
                  >
                    <CartesianGrid strokeOpacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={tick}
                      stroke="currentColor"
                      strokeOpacity={0.3}
                    />
                    <YAxis
                      tick={tick}
                      stroke="currentColor"
                      strokeOpacity={0.3}
                      width={56}
                    />
                    <Tooltip
                      formatter={(v: number) => brl(v * 100)}
                      contentStyle={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="income"
                      name="Receitas"
                      fill={primary}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expense"
                      name="Despesas"
                      fill="#FF6B6B"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Receitas e despesas por mês</caption>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Receitas</th>
                    <th>Despesas</th>
                  </tr>
                </thead>
                <tbody>
                  {s.monthlySeries.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td>{brl(m.income)}</td>
                      <td>{brl(m.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section aria-labelledby="h-cat">
              <h2 id="h-cat">Despesas por categoria</h2>
              {s.expensesByCategory.length === 0 ? (
                <p className="muted">
                  Nenhuma despesa neste mês. Cadastre um lançamento para ver o
                  gráfico.
                </p>
              ) : (
                <>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={s.expensesByCategory.map((c) => ({
                            ...c,
                            total: c.total / 100,
                          }))}
                          dataKey="total"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                          stroke="var(--bg)"
                        >
                          {s.expensesByCategory.map((c) => (
                            <Cell key={c.name} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => brl(v * 100)}
                          contentStyle={{
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="legend">
                    {s.expensesByCategory.map((c) => (
                      <li key={c.name}>
                        <i style={{ background: c.color }} aria-hidden="true" />
                        {c.name}
                        <b>{brl(c.total)}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
