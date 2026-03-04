create table public.user_id_types (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text null,
  requires_expiry boolean default false,
  requires_front_back boolean default true,
  is_active boolean default true,
  created_at timestamp with time zone default now(),

  constraint user_id_types_pkey primary key (id)
);

create table public.user_identifications (
  id uuid not null default gen_random_uuid(),

  user_id uuid not null,
  id_type_id uuid not null,

  id_number text not null,
  issued_by text null,
  country_code char(2) null,

  issue_date date null,
  expiry_date date null,

  verification_status text default 'pending',
  verified_by uuid null,
  verified_at timestamp with time zone null,

  metadata jsonb default '{}',

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint user_identifications_pkey primary key (id),

  constraint user_identifications_user_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade,

  constraint user_identifications_type_fkey
  foreign key (id_type_id)
  references user_id_types(id)
);

create table public.user_file_attachments (
  id uuid not null default gen_random_uuid(),

  user_id uuid not null,

  id_record_id uuid null,

  file_label text not null,
  file_category text null,

  file_name text not null,
  file_url text not null,
  file_type text null,
  file_size bigint null,

  uploaded_by uuid null,
  uploaded_at timestamp with time zone default now(),

  metadata jsonb default '{}',

  constraint user_file_attachments_pkey primary key (id),

  constraint user_file_attachments_user_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade,

  constraint user_file_attachments_id_record_fkey
  foreign key (id_record_id)
  references user_identifications(id)
  on delete set null,

  constraint user_file_attachments_uploaded_by_fkey
  foreign key (uploaded_by)
  references profiles(id)
);

create index idx_user_identifications_user
on user_identifications(user_id);

create index idx_user_file_attachments_user
on user_file_attachments(user_id);

create index idx_user_file_attachments_record
on user_file_attachments(id_record_id);