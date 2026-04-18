-- Spectra AI — Migration 002: demo user seed
-- Run this AFTER enabling Supabase Auth and running migration 001.
--
-- Demo credentials are displayed on the landing page for recruiters:
--   Email:    demo@spectra.app
--   Password: spectra-demo
--
-- The demo user is a regular user — no special permissions.
-- Same rate limits apply: 3 job runs per day per IP via Upstash.

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
select
  uuid_generate_v4(),
  'demo@spectra.app',
  crypt('spectra-demo', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Demo User"}',
  false,
  'authenticated'
where not exists (
  select 1 from auth.users where email = 'demo@spectra.app'
);
