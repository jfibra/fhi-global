CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_address TEXT NOT NULL, -- The "one line" the user sees/searches
  street_line_1 TEXT,
  street_line_2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country_code CHAR(2),
  latitude DECIMAL(9,6), -- More precise/standard than POINT for web
  longitude DECIMAL(9,6),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate identical address records
  CONSTRAINT unique_physical_address UNIQUE (street_line_1, city, state_province, country_code)
);

CREATE TABLE public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  address_id uuid REFERENCES public.addresses(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home', -- Home, Office, etc.
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- This index ensures that for any given user_id, 
-- there can only be ONE row where is_primary is TRUE.
CREATE UNIQUE INDEX one_primary_per_user 
ON public.user_addresses (user_id) 
WHERE (is_primary IS TRUE);