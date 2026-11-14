CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE goal_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(60) NOT NULL,
  type transaction_type NOT NULL,
  color char(7) NOT NULL DEFAULT '#1E90FF' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, name),
  UNIQUE (id, user_id)   -- permite FK composta: transação só aponta para categoria do MESMO usuário
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  type transaction_type NOT NULL,
  description varchar(160) NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  occurred_on date NOT NULL,
  notes varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id)
);
CREATE INDEX transactions_user_date_idx ON transactions(user_id, occurred_on DESC) WHERE deleted_at IS NULL;

CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  target_cents bigint NOT NULL CHECK (target_cents > 0),
  current_cents bigint NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  deadline date,
  status goal_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX goals_user_idx ON goals(user_id);