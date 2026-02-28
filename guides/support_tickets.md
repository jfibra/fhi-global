create table public.support_tickets (
  id uuid not null default gen_random_uuid(),

  -- user who reported the issue
  reported_by uuid not null,

  -- ticket classification
  ticket_type text null,
  priority text default 'normal',
  status text default 'open',

  -- issue details
  title text not null,
  description text not null,

  -- where the issue happened
  page_url text null,
  module text null,

  -- technical environment
  device_type text null,
  device_os text null,
  browser text null,
  browser_version text null,

  -- network info
  ip_address text null,
  location_country text null,
  location_city text null,

  -- system information
  user_agent text null,
  screen_resolution text null,

  -- admin handling
  assigned_to uuid null,
  resolved_at timestamp with time zone null,

  -- audit
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint support_tickets_pkey primary key (id),

  constraint support_tickets_reported_by_fkey
  foreign key (reported_by)
  references public.profiles(id),

  constraint support_tickets_assigned_to_fkey
  foreign key (assigned_to)
  references public.profiles(id)
);

create table public.support_ticket_attachments (
  id uuid not null default gen_random_uuid(),

  ticket_id uuid not null,

  file_name text not null,
  file_url text not null,
  file_type text null,

  uploaded_by uuid null,
  uploaded_at timestamp with time zone default now(),

  constraint support_ticket_attachments_pkey primary key (id),

  constraint support_ticket_attachments_ticket_fkey
  foreign key (ticket_id)
  references public.support_tickets(id)
  on delete cascade,

  constraint support_ticket_attachments_uploaded_by_fkey
  foreign key (uploaded_by)
  references public.profiles(id)
);

create table public.support_ticket_comments (
  id uuid not null default gen_random_uuid(),

  ticket_id uuid not null,

  comment text not null,

  commented_by uuid not null,
  commenter_role text null,

  parent_comment_id uuid null,

  created_at timestamp with time zone default now(),

  constraint support_ticket_comments_pkey primary key (id),

  constraint support_ticket_comments_ticket_fkey
  foreign key (ticket_id)
  references public.support_tickets(id)
  on delete cascade,

  constraint support_ticket_comments_user_fkey
  foreign key (commented_by)
  references public.profiles(id),

  constraint support_ticket_comments_parent_fkey
  foreign key (parent_comment_id)
  references public.support_ticket_comments(id)
);

create index idx_support_tickets_status
on support_tickets(status);

create index idx_support_tickets_reported_by
on support_tickets(reported_by);

create index idx_support_tickets_assigned_to
on support_tickets(assigned_to);

create index idx_support_tickets_created_at
on support_tickets(created_at);