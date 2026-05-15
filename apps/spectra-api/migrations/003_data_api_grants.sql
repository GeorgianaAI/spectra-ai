-- Spectra AI — Migration 003: Explicit Data API grants
-- Context: Supabase is removing the default public-schema exposure from the Data API
-- (PostgREST, supabase-js, GraphQL) for new projects from 2026-05-30 and all existing
-- projects from 2026-10-30. Without explicit GRANTs, authenticated requests return 42501
-- permission errors even when valid RLS policies are in place.
--
-- Roles:
--   authenticated — spectra-app uses supabase-js (Data API) with JWT-authenticated requests.
--   anon          — skipped; Spectra requires authentication for all operations.
--   service_role  — skipped; Lambda functions connect via direct Postgres connection string,
--                   not the Data API.
--
-- RLS policies already enforce per-user row isolation; these grants only unblock PostgREST
-- access at the schema layer. GRANT is idempotent — safe to run multiple times.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
