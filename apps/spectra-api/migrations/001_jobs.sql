-- Spectra AI — Migration 001: jobs table
-- Run this in the Supabase SQL editor after creating your project.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Jobs table
create table public.jobs (
  id                uuid         default uuid_generate_v4() primary key,
  user_id           uuid         references auth.users(id) on delete cascade not null,
  status            text         not null default 'pending'
                                 check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at        timestamptz  default now() not null,
  completed_at      timestamptz,
  result_url        text,
  -- { doc: number, vision: number, audio: number }
  confidence_scores jsonb        default '{}'::jsonb,
  -- [{ timestamp, agent, finding, confidence, nistTag }]
  governance_trace  jsonb        default '[]'::jsonb,
  -- { document: boolean, vision: boolean, audio: boolean }
  modalities_used   jsonb        default '{}'::jsonb,
  error             text
);

-- Indexes for history queries and status polling
create index jobs_user_id_idx    on public.jobs(user_id);
create index jobs_created_at_idx on public.jobs(created_at desc);
create index jobs_status_idx     on public.jobs(status);

-- Row Level Security — users can only access their own jobs
alter table public.jobs enable row level security;

create policy "Users can view their own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on public.jobs for update
  using (auth.uid() = user_id);
