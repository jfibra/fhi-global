create table public.sales_activity_logs (
  id uuid not null default gen_random_uuid(),

  sales_report_id uuid not null,

  action_type text not null,
  field_name text null,

  old_value jsonb null,
  new_value jsonb null,

  description text null,

  performed_by uuid null,
  performed_role text null,

  created_at timestamp with time zone default now(),

  constraint sales_activity_logs_pkey primary key (id),

  constraint sales_activity_logs_sales_fkey
  foreign key (sales_report_id) references public.sales_reports(id) on delete cascade,

  constraint sales_activity_logs_user_fkey
  foreign key (performed_by) references public.profiles(id)
);

create table public.sales_validation_comments (
  id uuid not null default gen_random_uuid(),

  sales_report_id uuid not null,

  parent_comment_id uuid null,

  comment text not null,

  commented_by uuid not null,
  commenter_role text null,

  is_admin_comment boolean default false,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint sales_validation_comments_pkey primary key (id),

  constraint sales_validation_comments_sale_fkey
  foreign key (sales_report_id)
  references public.sales_reports(id)
  on delete cascade,

  constraint sales_validation_comments_parent_fkey
  foreign key (parent_comment_id)
  references public.sales_validation_comments(id)
  on delete cascade,

  constraint sales_validation_comments_user_fkey
  foreign key (commented_by)
  references public.profiles(id)
);