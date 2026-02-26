create table public.company_tax_entities (
  id uuid not null default gen_random_uuid(),

  -- Company identity
  registered_name text not null,
  trade_name text null,

  -- Dubai / UAE VAT TRN
  tax_registration_number text not null,

  -- purpose of entity
  entity_type text not null check (entity_type in ('sale','purchase')),

  -- link to developer if this is a sales entity
  developer_id uuid null,

  -- company classification
  company_type text null,

  -- address information
  country_code char(2) not null,
  state_province text null,
  city text null,
  street_address text null,
  building text null,
  postal_code text null,

  -- tax settings
  vat_registered boolean default true,
  vat_rate numeric(5,2) default 5.00,

  -- currency
  currency_code char(3) default 'AED',

  -- metadata
  metadata jsonb default '{}'::jsonb,

  -- system
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone null,

  constraint company_tax_entities_pkey primary key (id),
  constraint company_tax_entities_developer_fkey
    foreign key (developer_id) references public.developers(id)
);

create index idx_tax_entities_trn
on public.company_tax_entities(tax_registration_number);

create index idx_tax_entities_developer
on public.company_tax_entities(developer_id);

create index idx_tax_entities_type
on public.company_tax_entities(entity_type);

create trigger on_tax_entity_update
before update on public.company_tax_entities
for each row
execute function handle_updated_at();