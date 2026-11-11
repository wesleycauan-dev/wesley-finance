# Wesley Finance

SaaS de controle financeiro para uso pessoal.

**Projeto em Construção**

<!-- SaaS de controle financeiro. Proprietário: Wesley Cauan (admin vitalício e gratuito). -->
<!-- Status: **Etapa 1 — backend de autenticação e banco de dados.** Veja `docs/ARCHITECTURE.md`. -->

<!-- ## Rodando localmente
```bash
docker compose up -d                 # PostgreSQL
cp .env.example .env                 # edite os segredos e os dados do proprietário
cd backend && npm install
cp ../.env .env                      # ou exporte as variáveis
npm run migrate && npm run seed:owner
npm run dev                          # http://localhost:3333/api/health
```

## Endpoints (Etapa 1)
| Método | Rota | Descrição |
|---|---|---|
| POST | /api/auth/register | `{name,email,password,acceptTerms:true}` |
| POST | /api/auth/login | `{email,password}` → `accessToken` + cookie de refresh |
| POST | /api/auth/refresh | rotaciona o refresh token |
| POST | /api/auth/logout | revoga a sessão |
| GET | /api/auth/me | nome, role, assinatura, preferências (para a boas-vindas) |

Nunca versione o `.env`. Troque todos os segredos antes de qualquer deploy. -->
