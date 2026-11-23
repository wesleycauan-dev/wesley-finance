# API financeira

Todas as rotas exigem `Authorization: Bearer <accessToken>` e acesso ativo (proprietário ou assinatura `active`; senão HTTP 402).
Valores monetários são **inteiros em centavos** (`amountCents`). Datas em `YYYY-MM-DD`.

| Método         | Rota                         | Descrição                                                                        |
| -------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| GET/POST       | /api/categories              | listar (`?type=`) / criar `{name,type,color}`                                    |
| PUT/DELETE     | /api/categories/:id          | editar `{name,color}` / excluir (409 se em uso)                                  |
| GET            | /api/transactions            | filtros: `type, categoryId, from, to, page, limit`                               |
| POST           | /api/transactions            | `{type,categoryId,description,amountCents,occurredOn,notes?}`                    |
| GET/PUT/DELETE | /api/transactions/:id        | detalhe / substituir / exclusão lógica                                           |
| GET/POST       | /api/goals                   | listar / criar `{name,targetCents,deadline?}`                                    |
| PUT/DELETE     | /api/goals/:id               | editar / excluir                                                                 |
| POST           | /api/goals/:id/contributions | aporte `{amountCents}`; conclui a meta ao atingir o alvo                         |
| GET            | /api/dashboard/summary       | `?month=YYYY-MM`: totais, saldo, despesas por categoria, série de 6 meses, metas |

Isolamento: toda query filtra por `user_id` do token; a FK composta `(category_id,user_id)` impede, no banco, que um lançamento use categoria de outro usuário.

# Assinaturas e pagamentos (Etapa 3)

| Método | Rota                      | Descrição                                                                                              |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | /api/billing/checkout     | cria a assinatura no Mercado Pago e devolve `checkoutUrl` (redirecionar o usuário). Não libera acesso. |
| GET    | /api/billing/status       | status, vencimento e preço                                                                             |
| GET    | /api/billing/payments     | histórico de pagamentos do usuário (`page`, `limit`)                                                   |
| POST   | /api/billing/cancel       | cancela; acesso mantido até o fim do período pago                                                      |
| POST   | /api/webhooks/mercadopago | webhook (sem login; valida `x-signature` HMAC-SHA256)                                                  |

## Fluxo seguro

1. Usuário chama `/checkout` → status `pending`, é redirecionado ao checkout hospedado do Mercado Pago (nenhum dado de cartão passa pelo nosso servidor).
2. O Mercado Pago notifica `/api/webhooks/mercadopago`. Validamos a assinatura em tempo constante.
3. O corpo do webhook **não é confiável**: usamos só o `data.id` assinado para consultar a API do Mercado Pago e gravar o estado real. Também conferimos que a assinatura existe no nosso banco e que o valor é o nosso preço.
4. Idempotência: pagamentos têm chave única (`mp_authorized_payment_id`); reenvios apenas atualizam a mesma linha.
5. Acesso: `active`, ou `cancelled` dentro do período pago, com carência de 3 dias após o vencimento.

+## Configuração no painel do Mercado Pago
+Aplicação → Webhooks → URL `https://SEU-DOMINIO/api/webhooks/mercadopago`, eventos de **Planos e assinaturas** (`subscription_preapproval` e `subscription_authorized_payment`). Copie a chave secreta para `MP_WEBHOOK_SECRET`. Em desenvolvimento use um túnel (ngrok/cloudflared) e as credenciais de teste.

# Administração (Etapa 5) — somente proprietário

| Método | Rota                        | Descrição                                          |
| ------ | --------------------------- | -------------------------------------------------- |
| GET    | /api/admin/overview         | usuários, assinaturas por status, MRR, receita     |
| GET    | /api/admin/users            | `search`, `status`, `page`, `limit`                |
| PATCH  | /api/admin/users/:id/active | `{isActive}` bloqueia/desbloqueia e revoga sessões |
| GET    | /api/admin/payments         | pagamentos recentes                                |

+O admin não tem acesso aos lançamentos, categorias ou metas dos usuários. O papel é lido do banco a cada requisição, e contas bloqueadas perdem acesso na hora.

# LGPD

| Método | Rota                 | Descrição                                                                                                                                      |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /api/privacy/export  | JSON com todos os dados do titular                                                                                                             |
| DELETE | /api/privacy/account | `{password}` apaga dados e anonimiza o cadastro; cancela a cobrança antes. Mantém pagamentos/consentimentos/auditoria sem identificação direta |
| PUT    | /api/preferences     | tema e cores                                                                                                                                   |
