-- ============================================================================
-- Sitara Traders — Phase 1 migration
-- Run this AFTER your existing 10 tables are created.
-- Adds: user_profiles + roles, soft-delete on clients, code-generation
-- functions, installment auto-generation trigger, and RLS policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Soft delete on clients
-- ----------------------------------------------------------------------------
alter table clients
  add column if not exists is_deleted boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. User profiles + roles
-- Supabase Auth manages auth.users. We mirror role info in a public table
-- because auth.users is not directly queryable from the client with RLS
-- in a convenient way, and we need a role to gate access.
-- ----------------------------------------------------------------------------
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'partner' check (role in ('admin', 'partner')),
  created_at timestamptz default now()
);

-- Keep user_profiles.email in sync and auto-create a profile row whenever
-- a new auth user is created (e.g. via admin invite).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'partner')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Sequential code generators (CL-0001, CNT-0001) — atomic via sequences
-- ----------------------------------------------------------------------------
create sequence if not exists client_code_seq start 1;
create sequence if not exists contract_code_seq start 1;

create or replace function next_client_code()
returns text
language sql
as $$
  select 'CL-' || lpad(nextval('client_code_seq')::text, 4, '0');
$$;

create or replace function next_contract_code()
returns text
language sql
as $$
  select 'CNT-' || lpad(nextval('contract_code_seq')::text, 4, '0');
$$;

-- Keep sequences in sync with any existing rows the first time this runs.
select setval(
  'client_code_seq',
  coalesce((select max(substring(client_code from 4)::int) from clients), 0) + 1,
  false
);
select setval(
  'contract_code_seq',
  coalesce((select max(substring(contract_code from 5)::int) from contracts), 0) + 1,
  false
);

-- ----------------------------------------------------------------------------
-- 4. updated_at auto-touch trigger (generic, reused on every table that has it)
-- ----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.sync_version = coalesce(old.sync_version, 1) + 1;
  return new;
end;
$$;

drop trigger if exists trg_clients_touch on clients;
create trigger trg_clients_touch
  before update on clients
  for each row execute function touch_updated_at();

drop trigger if exists trg_contracts_touch on contracts;
create trigger trg_contracts_touch
  before update on contracts
  for each row execute function touch_updated_at();

drop trigger if exists trg_payments_touch on payments;
create trigger trg_payments_touch
  before update on payments
  for each row execute function touch_updated_at();

-- installments has updated_at but no sync_version column, use a lighter trigger
create or replace function touch_updated_at_only()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_installments_touch on installments;
create trigger trg_installments_touch
  before update on installments
  for each row execute function touch_updated_at_only();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- All authenticated users (admin + partner) can read/write business data.
-- Only admins can manage user_profiles.
-- ----------------------------------------------------------------------------
alter table clients enable row level security;
alter table contracts enable row level security;
alter table installments enable row level security;
alter table payments enable row level security;
alter table payment_edits enable row level security;
alter table investors enable row level security;
alter table business_phases enable row level security;
alter table investor_phase_investments enable row level security;
alter table profit_distributions enable row level security;
alter table user_profiles enable row level security;

-- Helper: is the current user an authenticated business user at all?
create or replace function is_authenticated_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from user_profiles where id = auth.uid()
  );
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from user_profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Business tables: any logged-in staff member (admin or partner) has full access.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'contracts', 'installments', 'payments',
    'payment_edits', 'investors', 'business_phases',
    'investor_phase_investments', 'profit_distributions'
  ]
  loop
    execute format(
      'drop policy if exists staff_full_access on %I;', t
    );
    execute format(
      'create policy staff_full_access on %I for all using (is_authenticated_staff()) with check (is_authenticated_staff());',
      t
    );
  end loop;
end $$;

-- user_profiles: everyone can read their own row + admins can read/write all
drop policy if exists self_read on user_profiles;
create policy self_read on user_profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists admin_write on user_profiles;
create policy admin_write on user_profiles
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- End of migration. After running this:
-- 1. Create one admin user via Supabase Dashboard > Authentication > Add User
--    (or via the seed script described in README), with
--    raw_user_meta_data = { "role": "admin", "full_name": "..." }
-- 2. All further partner accounts should be created via the in-app
--    "Invite Partner" flow (admin-only), which calls supabase.auth.admin.inviteUserByEmail.
-- ============================================================================
