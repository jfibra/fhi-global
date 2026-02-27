
create table public.clients (
  id uuid not null default gen_random_uuid(),

  first_name text not null,
  middle_name text null,
  last_name text not null,

  email text null,
  phone text null,

  age integer null,
  gender text null,

  occupation text null,

  street text null,
  city text null,
  state_province text null,
  country text null,

  created_at timestamp with time zone default now(),

  constraint clients_pkey primary key (id)
);

create table public.sales_reports (
  id uuid not null default gen_random_uuid(),

  -- agent who made the sale
  agent_id uuid not null,

  -- developer and project
  developer_id uuid not null,
  project_id integer not null,

  -- project unit reference
  project_unit_id integer null,

  -- specific unit identifier
  unit_number text null,
  block_number text null,
  lot_number text null,

  -- client
  client_id uuid not null,

  -- contract information
  contract_price numeric(14,2) not null,
  reservation_date date null,

  payment_plan text null,
  payment_terms text null,

  -- project pricing snapshot
  price_per_sqm numeric(14,2) null,
  total_area_sqm numeric(14,2) null,

  -- sales workflow
  commission_status text default 'pending',
  validation_status text default 'pending',

  -- proof of transaction
  proof_of_transaction_url text null,

  -- remarks
  remarks text null,

  -- audit
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid null,
  updated_by uuid null,

  constraint sales_reports_pkey primary key (id),

  constraint sales_reports_agent_fkey
  foreign key (agent_id) references public.profiles(id),

  constraint sales_reports_project_fkey
  foreign key (project_id) references public.projects(id),

  constraint sales_reports_developer_fkey
  foreign key (developer_id) references public.developers(id),

  constraint sales_reports_project_unit_fkey
  foreign key (project_unit_id) references public.project_units(id),

  constraint sales_reports_client_fkey
  foreign key (client_id) references public.clients(id)
);


create table public.sales_attachments (
  id uuid not null default gen_random_uuid(),

  sales_report_id uuid not null,

  file_name text not null,
  file_url text not null,
  file_type text null,

  uploaded_by uuid null,
  uploaded_at timestamp with time zone default now(),

  constraint sales_attachments_pkey primary key (id),

  constraint sales_attachments_sales_fkey
  foreign key (sales_report_id) references public.sales_reports(id) on delete cascade,

  constraint sales_attachments_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id)
);

create index idx_sales_reports_agent on sales_reports(agent_id);
create index idx_sales_reports_project on sales_reports(project_id);
create index idx_sales_reports_reservation_date on sales_reports(reservation_date);