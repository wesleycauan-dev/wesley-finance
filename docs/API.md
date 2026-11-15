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
