# Arquitetura — Wesley Finance

## Stack
React + TypeScript + Vite + Framer Motion (frontend) · Node.js + Express + TypeScript (API REST) · PostgreSQL 16.

## Decisões de segurança (Etapa 1)
- **Senhas:** Argon2id. Política mínima de 10 caracteres com maiúscula, minúscula e número.
- **Sessão:** access token JWT (15 min, em memória no frontend) + refresh token opaco (30 dias) em cookie `httpOnly`, `SameSite=Strict`, `Secure` em produção. Só o **hash SHA-256** do refresh token é salvo no banco.
- **Rotação com detecção de reuso:** cada refresh gera um novo token; reutilizar um token já revogado revoga toda a família.
- **Anti força-bruta:** rate limit por IP + bloqueio da conta por 15 min após 5 falhas; resposta genérica e tempo equalizado (hash fictício) para não revelar se o e-mail existe.
- **Proprietário:** índice único parcial garante no máximo 1 `owner`; criado apenas via `npm run seed:owner`; o cadastro público rejeita o e-mail do proprietário e nunca atribui role `owner`.
- **Autorização:** `requireAuth` → `requireOwner` (admin) → `requireActiveAccess` (assinatura `active` ou owner). Status da assinatura só mudará por **webhook validado** (Etapa 3), nunca por chamada do cliente.
- **Isolamento de dados:** toda tabela financeira terá `user_id` e toda query filtrará pelo `req.user.id` do token (nunca por parâmetro do cliente).
- **LGPD:** consentimento versionado (`consents`), minimização de dados, `audit_logs`, e (Etapa 4) exportação dos dados do titular, exclusão de conta e anonimização.

## Modelo de dados atual
users · refresh_tokens · user_preferences · subscriptions · consents · audit_logs
(Etapa 2 acrescenta: categories, transactions, goals, payments; Etapa 3: eventos de webhook.)

## Roadmap
1. ✅ Arquitetura, PostgreSQL, migrations, autenticação
2. API financeira: categorias, receitas, despesas, metas, dashboard (agregações)
3. Mercado Pago: assinatura, webhook com validação de assinatura x-signature e idempotência, histórico de pagamentos
4. Frontend React: login/cadastro, dashboard, gráficos, temas, Framer Motion, acessibilidade
5. Painel administrativo, LGPD (export/exclusão), testes e deploy
