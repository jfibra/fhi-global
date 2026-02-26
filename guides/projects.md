-- 1. Core Projects table
CREATE TABLE public.projects (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  about_project TEXT,
  status TEXT NOT NULL CHECK (status IN ('pre_launch', 'launch', 'under_construction', 'completed')),
  developer_id UUID REFERENCES public.developers(id) ON DELETE SET NULL,
  location TEXT,
  region TEXT,
  community TEXT,
  sub_community TEXT,
  city TEXT,
  country TEXT,
  latitude TEXT,
  longitude TEXT,
  launch_price_from NUMERIC(14,2),
  launch_price_to NUMERIC(14,2),
  currency TEXT,
  government_fee_percentage NUMERIC(5,2),
  down_payment_percentage NUMERIC(5,2),
  payment_plan_details TEXT,
  installment_available BOOLEAN DEFAULT false,
  booking_date DATE,
  construction_start_date DATE,
  expected_completion_date DATE,
  delivery_date DATE,
  delivery_quarter TEXT,
  number_of_buildings INTEGER,
  total_units INTEGER,
  floors INTEGER,
  main_image TEXT,
  floor_plans TEXT,
  video_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  expected_roi NUMERIC(5,2),
  rental_yield NUMERIC(5,2),
  freehold BOOLEAN DEFAULT true,
  ownership_type TEXT,
  sales_contact_phone TEXT,
  sales_contact_email TEXT,
  direct_from_developer BOOLEAN DEFAULT false,
  rating NUMERIC(3,2) DEFAULT 0.00,
  reviews_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_projects_slug ON public.projects(slug);
CREATE INDEX idx_projects_status ON public.projects(status);

-- 1.5. Sample project insert (Aqua Arc)
INSERT INTO public.projects (
  name,
  slug,
  description,
  about_project,
  status,
  developer_id,
  location,
  region,
  community,
  sub_community,
  city,
  country,
  latitude,
  longitude,
  launch_price_from,
  launch_price_to,
  currency,
  government_fee_percentage,
  down_payment_percentage,
  payment_plan_details,
  installment_available,
  booking_date,
  construction_start_date,
  delivery_date,
  delivery_quarter,
  number_of_buildings,
  total_units,
  floors,
  main_image,
  floor_plans,
  meta_title,
  meta_description,
  is_featured,
  is_premium,
  expected_roi,
  rental_yield,
  freehold,
  ownership_type,
  sales_contact_phone,
  sales_contact_email,
  direct_from_developer,
  rating,
  reviews_count,
  is_active,
  is_published,
  published_at,
  created_at,
  updated_at,
  created_by,
  updated_by
) VALUES (
  'Aqua Arc',
  'aqua-arc',
  'A stunning waterfront residential development featuring modern apartments with panoramic views of Dubai Marina.',
  'Aqua Arc by BNW Developments is an architectural masterpiece that redefines luxury living in Dubai Marina. This premium development offers residents breathtaking water views, world-class amenities, and sophisticated design elements. Each residence is meticulously crafted with high-end finishes and smart home technology.',
  'under_construction',
  (SELECT id FROM public.developers WHERE slug = 'bnw-developments'),
  'Dubai Marina',
  'Dubai',
  'Marina Walk',
  'Marina Promenade',
  'Dubai Marina',
  'UAE',
  '25.06570000',
  '55.13900000',
  2240000.00,
  29000000.00,
  'AED',
  4.00,
  20.00,
  '20% on booking, 50% during construction, 30% on completion',
  true,
  '2024-02-01',
  '2024-04-15',
  '2027-03-31',
  'Q1 2027',
  1,
  280,
  45,
  'https://filipinohomes123.s3.ap-southeast-1.amazonaws.com/grbucket/projects/9/main_image/main_68da2912e7fe6.png',
  'https://filipinohomes123.s3.ap-southeast-1.amazonaws.com/grbucket/projects/9/floor_plans/floor_plans_68db4984684ae.pdf',
  'Aqua Arc by BNW Developments - Luxury Marina Apartments',
  'Discover Aqua Arc, a premium waterfront development in Dubai Marina by BNW Developments. Luxury apartments with marina views and world-class amenities.',
  true,
  true,
  9.20,
  6.80,
  true,
  'Freehold',
  '+971-54-999-4155',
  'sales@bnw.ae',
  true,
  4.70,
  124,
  true,
  true,
  '2025-09-24T07:12:41.000000Z',
  '2025-09-24T07:12:41.000000Z',
  '2025-09-24T07:12:41.000000Z',
  NULL,
  NULL
) ON CONFLICT (slug) DO NOTHING;
-- 2. Property types lookup and many-to-many
CREATE TABLE public.property_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE public.project_property_types (
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  property_type_id INTEGER REFERENCES public.property_types(id) ON DELETE CASCADE,
  PRIMARY KEY(project_id, property_type_id)
);

-- 3. Amenities list (normalized to reuse common amenities)
CREATE TABLE public.amenities (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE public.project_amenities (
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  amenity_id INTEGER REFERENCES public.amenities(id) ON DELETE CASCADE,
  PRIMARY KEY(project_id, amenity_id)
);

-- 4. Nearby points (schools, hospitals, transport, shopping)
CREATE TABLE public.project_points (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('attraction','transport','school','hospital','shopping')),
  description TEXT
);

-- 5. Features list
CREATE TABLE public.project_features (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL
);

-- 6. Images table so galleries are reusable per project but stored separately
CREATE TABLE public.project_images (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumb TEXT,
  is_main BOOLEAN DEFAULT false,
  rank INTEGER DEFAULT 0
);

-- 7. Virtual tours / videos (one-to-many)
CREATE TABLE public.project_media (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT CHECK (media_type IN ('video','virtual_tour')) NOT NULL,
  url TEXT NOT NULL
);

-- 8. Unit types table (housekeeping for each floor plan)
CREATE TABLE public.project_units (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  layout_name TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  size_sqft NUMERIC(10,2),
  size_sqm NUMERIC(10,2),
  price_from NUMERIC(14,2),
  price_to NUMERIC(14,2),
  floor_plan_image TEXT,
  available_units INTEGER,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Keywords/tags
CREATE TABLE public.project_keywords (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL
);

-- 10. Transportation references (in case there are scores or times to index)
CREATE TABLE public.project_transport_links (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL
);

-- 11. Nearby services (schools, hospitals, malls)
CREATE TABLE public.project_neighbors (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('school','hospital','shopping')),
  description TEXT NOT NULL
);

-- 12. Reviews meta (aggregate counts handled on project row)
CREATE OR REPLACE FUNCTION public.handle_project_updates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_update
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_updates();

-- 13. Seed values (sample property types + amenities)
INSERT INTO public.property_types (name) VALUES
  ('Apartment'),
  ('Penthouse'),
  ('Townhouse'),
  ('Villa')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.amenities (name) VALUES
  ('Balcony'),
  ('Central A/C'),
  ('Concierge'),
  ('Gym'),
  ('Pool'),
  ('Parking'),
  ('Security')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.project_keywords (project_id, keyword)
SELECT p.id, k.keyword
FROM (VALUES
  ('BNW Developments'),
  ('Dubai Marina'),
  ('waterfront')
) AS k(keyword)
CROSS JOIN (SELECT id FROM public.projects WHERE slug = 'aqua-arc') p;
