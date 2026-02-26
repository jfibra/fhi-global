create table public.purchases (
  id uuid not null default gen_random_uuid(),

  -- vendor entity
  tax_entity_id uuid not null,

  -- accounting
  tax_month date not null,
  tax_type text not null check (tax_type in ('vat','non_vat')),

  -- invoice
  invoice_number text not null,

  -- amounts
  gross_taxable numeric(14,2) null,
  total_actual_amount numeric(14,2) not null,

  -- category
  category_id uuid null,

  -- currency
  currency_code char(3) default 'AED',

  -- notes
  notes text null,

  -- audit
  created_by uuid null,
  updated_by uuid null,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone null,

  constraint purchases_pkey primary key (id),

  constraint purchases_tax_entity_fkey
  foreign key (tax_entity_id) references public.company_tax_entities(id),

  constraint purchases_category_fkey
  foreign key (category_id) references public.purchase_categories(id),

  constraint purchases_created_by_fkey
  foreign key (created_by) references public.profiles(id)
);

create index idx_purchases_tax_entity
on public.purchases(tax_entity_id);

create index idx_purchases_tax_month
on public.purchases(tax_month);

create index idx_purchases_invoice
on public.purchases(invoice_number);

create trigger on_purchase_update
before update on purchases
for each row
execute function handle_updated_at();

create table public.purchase_attachments (
  id uuid not null default gen_random_uuid(),

  purchase_id uuid not null,

  file_name text not null,
  file_url text not null,
  file_type text null,

  uploaded_by uuid null,
  uploaded_at timestamp with time zone default now(),

  metadata jsonb default '{}'::jsonb,

  constraint purchase_attachments_pkey primary key (id),

  constraint purchase_attachments_purchase_fkey
  foreign key (purchase_id) references public.purchases(id) on delete cascade,

  constraint purchase_attachments_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id)
);

create index idx_purchase_attachments_purchase
on public.purchase_attachments(purchase_id);

create table public.purchase_categories (
  id uuid not null default gen_random_uuid(),

  category_name text not null,

  category_type text not null
  check (category_type in ('default','custom')),

  created_by uuid null,

  created_at timestamp with time zone default now(),

  is_active boolean default true,

  constraint purchase_categories_pkey primary key (id),

  constraint purchase_categories_created_by_fkey
  foreign key (created_by) references public.profiles(id)
);

create index idx_purchase_categories_name
on public.purchase_categories(category_name);
