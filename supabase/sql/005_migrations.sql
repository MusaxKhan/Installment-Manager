-- ============================================================================
-- Sitara Traders — Migration 005
-- Run this in the Supabase SQL editor.
--
-- Adds a function the app calls to show "how full is my database"
-- as a percentage on the dashboard. There's no client-accessible way
-- to read Postgres's own size stats through the normal PostgREST
-- table API, so this wraps pg_database_size() in a small function and
-- exposes it as an RPC instead.
-- ============================================================================

create or replace function public.get_database_size_bytes()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

-- Callable by any authenticated staff member (matches this app's other
-- RLS-gated RPCs) — this is a single aggregate number, nothing
-- sensitive about individual rows.
grant execute on function public.get_database_size_bytes() to authenticated;

-- ============================================================================
-- End of migration 005.
-- ============================================================================
