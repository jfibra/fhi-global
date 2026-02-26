-- Bank Accounts schema
CREATE TABLE public.user_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_branch TEXT,
  bank_country CHAR(2),
  bank_type TEXT,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  iban TEXT,
  swift_code TEXT,
  routing_number TEXT,
  currency_code CHAR(3) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX ON public.user_bank_accounts (user_id) WHERE (is_primary);
