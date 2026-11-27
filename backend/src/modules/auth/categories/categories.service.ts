import type { PoolClient } from "pg";

const DEFAULTS: [string, "income" | "expense", string][] = [
  ["Salário", "income", "#1E90FF"],
  ["Freelance", "income", "#00BFFF"],
  ["Investimentos", "income", "#4169E1"],
  ["Outras receitas", "income", "#5F9EA0"],
  ["Moradia", "expense", "#1E90FF"],
  ["Alimentação", "expense", "#FF8C00"],
  ["Transporte", "expense", "#8A2BE2"],
  ["Saúde", "expense", "#DC143C"],
  ["Lazer", "expense", "#20B2AA"],
  ["Educação", "expense", "#DAA520"],
  ["Outras despesas", "expense", "#708090"],
];

export async function seedDefaultCategories(c: PoolClient, userId: string) {
  await c.query(
    `INSERT INTO categories(user_id,name,type,color)
     SELECT $1, n, t::transaction_type, col
     FROM unnest($2::text[], $3::text[], $4::text[]) AS d(n,t,col)
     ON CONFLICT (user_id, type, name) DO NOTHING`,
    [
      userId,
      DEFAULTS.map((d) => d[0]),
      DEFAULTS.map((d) => d[1]),
      DEFAULTS.map((d) => d[2]),
    ],
  );
}
