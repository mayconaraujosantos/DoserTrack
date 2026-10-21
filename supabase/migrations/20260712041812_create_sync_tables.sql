-- Cria as tabelas de sincronização cloud (medicines, schedules, doses) que
-- lib/sync.ts espera em public.*. Espelha o schema SQLite local (docs/SDD.md
-- §6) com adição de user_id para multi-tenancy e RLS por usuário.
--
-- id é o mesmo INTEGER PRIMARY KEY autoincrement do SQLite local — o cliente
-- envia o valor no upsert (onConflict: 'id'), não é gerado pelo Postgres.

CREATE TABLE IF NOT EXISTS public.medicines (
  id                  BIGINT PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id          BIGINT NOT NULL,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL,
  stock_quantity      NUMERIC NOT NULL DEFAULT 0,
  stock_unit          TEXT NOT NULL DEFAULT 'unidades',
  photo_uri           TEXT,
  low_stock_threshold NUMERIC DEFAULT 5,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_medicines_user_id ON public.medicines(user_id);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own medicines" ON public.medicines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.schedules (
  id               BIGINT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id       BIGINT NOT NULL,
  medicine_id      BIGINT NOT NULL,
  dosage           TEXT NOT NULL,
  frequency_config JSONB NOT NULL,
  start_date       TEXT NOT NULL,
  end_date         TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules(user_id);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own schedules" ON public.schedules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.doses (
  id              BIGINT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id      BIGINT NOT NULL,
  schedule_id     BIGINT NOT NULL,
  medicine_id     BIGINT NOT NULL,
  scheduled_time  TEXT NOT NULL,
  taken_time      TEXT,
  status          TEXT DEFAULT 'pending',
  skip_reason     TEXT,
  notification_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doses_user_id ON public.doses(user_id);

ALTER TABLE public.doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own doses" ON public.doses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
