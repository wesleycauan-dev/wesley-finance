CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mp_authorized_payment_id text NOT NULL UNIQUE,   -- chave de idempotência: o mesmo evento nunca duplica o pagamento
  mp_payment_id text,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  status varchar(20) NOT NULL CHECK (status IN ('approved','pending','rejected','refunded','cancelled')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_user_idx ON payments(user_id, created_at DESC);

-- Registro de notificações recebidas (auditoria/diagnóstico). Não guarda payload nem dados pessoais.
CREATE TABLE webhook_events (
  id bigserial PRIMARY KEY,
  topic varchar(60),
  resource_id varchar(80),
  request_id varchar(80),
  outcome varchar(40) NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now()
);