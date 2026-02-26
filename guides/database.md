-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_address text NOT NULL,
  street_line_1 text,
  street_line_2 text,
  city text,
  state_province text,
  postal_code text,
  country_code character,
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.amenities (
  id integer NOT NULL DEFAULT nextval('amenities_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT amenities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.developers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  website_url text,
  phone text,
  email text,
  address text,
  rating numeric DEFAULT 0.00,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT developers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role text DEFAULT 'agent'::text,
  fname text,
  mname text,
  lname text,
  fullname text,
  birthday date,
  gender text,
  profile_url text,
  status text DEFAULT 'active'::text,
  timezone text DEFAULT 'UTC'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  joined_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_role_fkey FOREIGN KEY (role) REFERENCES public.user_roles(name)
);
CREATE TABLE public.project_amenities (
  project_id integer NOT NULL,
  amenity_id integer NOT NULL,
  CONSTRAINT project_amenities_pkey PRIMARY KEY (project_id, amenity_id),
  CONSTRAINT project_amenities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_amenities_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenities(id)
);
CREATE TABLE public.project_features (
  id integer NOT NULL DEFAULT nextval('project_features_id_seq'::regclass),
  project_id integer,
  description text NOT NULL,
  CONSTRAINT project_features_pkey PRIMARY KEY (id),
  CONSTRAINT project_features_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_images (
  id integer NOT NULL DEFAULT nextval('project_images_id_seq'::regclass),
  project_id integer,
  url text NOT NULL,
  thumb text,
  is_main boolean DEFAULT false,
  rank integer DEFAULT 0,
  CONSTRAINT project_images_pkey PRIMARY KEY (id),
  CONSTRAINT project_images_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_keywords (
  id integer NOT NULL DEFAULT nextval('project_keywords_id_seq'::regclass),
  project_id integer,
  keyword text NOT NULL,
  CONSTRAINT project_keywords_pkey PRIMARY KEY (id),
  CONSTRAINT project_keywords_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_media (
  id integer NOT NULL DEFAULT nextval('project_media_id_seq'::regclass),
  project_id integer,
  media_type text NOT NULL CHECK (media_type = ANY (ARRAY['video'::text, 'virtual_tour'::text])),
  url text NOT NULL,
  CONSTRAINT project_media_pkey PRIMARY KEY (id),
  CONSTRAINT project_media_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_neighbors (
  id integer NOT NULL DEFAULT nextval('project_neighbors_id_seq'::regclass),
  project_id integer,
  category text CHECK (category = ANY (ARRAY['school'::text, 'hospital'::text, 'shopping'::text])),
  description text NOT NULL,
  CONSTRAINT project_neighbors_pkey PRIMARY KEY (id),
  CONSTRAINT project_neighbors_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_points (
  id integer NOT NULL DEFAULT nextval('project_points_id_seq'::regclass),
  project_id integer,
  category text CHECK (category = ANY (ARRAY['attraction'::text, 'transport'::text, 'school'::text, 'hospital'::text, 'shopping'::text])),
  description text,
  CONSTRAINT project_points_pkey PRIMARY KEY (id),
  CONSTRAINT project_points_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_property_types (
  project_id integer NOT NULL,
  property_type_id integer NOT NULL,
  CONSTRAINT project_property_types_pkey PRIMARY KEY (project_id, property_type_id),
  CONSTRAINT project_property_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_property_types_property_type_id_fkey FOREIGN KEY (property_type_id) REFERENCES public.property_types(id)
);
CREATE TABLE public.project_transport_links (
  id integer NOT NULL DEFAULT nextval('project_transport_links_id_seq'::regclass),
  project_id integer,
  description text NOT NULL,
  CONSTRAINT project_transport_links_pkey PRIMARY KEY (id),
  CONSTRAINT project_transport_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_units (
  id integer NOT NULL DEFAULT nextval('project_units_id_seq'::regclass),
  project_id integer,
  unit_type text NOT NULL,
  layout_name text,
  bedrooms integer,
  bathrooms integer,
  size_sqft numeric,
  size_sqm numeric,
  price_from numeric,
  price_to numeric,
  floor_plan_image text,
  available_units integer,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_units_pkey PRIMARY KEY (id),
  CONSTRAINT project_units_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.projects (
  id integer NOT NULL DEFAULT nextval('projects_id_seq'::regclass),
  uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  about_project text,
  status text NOT NULL CHECK (status = ANY (ARRAY['pre_launch'::text, 'launch'::text, 'under_construction'::text, 'completed'::text])),
  developer_id uuid,
  location text,
  region text,
  community text,
  sub_community text,
  city text,
  country text,
  latitude text,
  longitude text,
  launch_price_from numeric,
  launch_price_to numeric,
  currency text,
  government_fee_percentage numeric,
  down_payment_percentage numeric,
  payment_plan_details text,
  installment_available boolean DEFAULT false,
  booking_date date,
  construction_start_date date,
  expected_completion_date date,
  delivery_date date,
  delivery_quarter text,
  number_of_buildings integer,
  total_units integer,
  floors integer,
  main_image text,
  floor_plans text,
  video_url text,
  meta_title text,
  meta_description text,
  is_featured boolean DEFAULT false,
  is_premium boolean DEFAULT false,
  views_count integer DEFAULT 0,
  expected_roi numeric,
  rental_yield numeric,
  freehold boolean DEFAULT true,
  ownership_type text,
  sales_contact_phone text,
  sales_contact_email text,
  direct_from_developer boolean DEFAULT false,
  rating numeric DEFAULT 0.00,
  reviews_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  published_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.developers(id)
);
CREATE TABLE public.property_types (
  id integer NOT NULL DEFAULT nextval('property_types_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT property_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.team_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  team_id uuid,
  role_in_team text DEFAULT 'member'::text,
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  is_active boolean DEFAULT (left_at IS NULL),
  transfer_reason text,
  CONSTRAINT team_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT team_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT team_memberships_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  logo_url text,
  parent_id uuid,
  team_type text DEFAULT 'department'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.teams(id)
);
CREATE TABLE public.user_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  address_id uuid,
  label text NOT NULL DEFAULT 'Home'::text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT user_addresses_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id),
  CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_roles (
  name text NOT NULL,
  label text NOT NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (name)
);