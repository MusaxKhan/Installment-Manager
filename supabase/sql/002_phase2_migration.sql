-- ============================================================================
-- Sitara Traders — Phase 2 migration
-- Run this AFTER 001_phase1_migration.sql.
-- Adds: withdrawals table, distribution-guard column on contracts,
-- RLS for investors/phases/investments/distributions, and an atomic
-- Postgres function that performs profit distribution in a single
-- transaction (avoids partial-write / double-distribution races that
-- are unavoidable when doing this as N sequential client-side calls).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Withdrawals table (was missing from the original 10 tables)
-- ----------------------------------------------------------------------------
create table if not exists withdrawals (
    id bigint generated always as identity primary key,

    investor_id bigint not null references investors(id) on delete cascade,

    amount numeric(12,2) not null check (amount > 0),

    reason text,

    withdrawal_date date not null default current_date,

    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    sync_version integer default 1
);

drop trigger if exists trg_withdrawals_touch on withdrawals;
create trigger trg_withdrawals_touch
  before update on withdrawals
  for each row execute function touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Distribution guard on contracts
-- A contract's profit must be distributed exactly once. Without this flag,
-- if recompute_contract_status() (or any retry/race) runs twice after
-- completion, profit could be distributed twice — silently doubling payouts.
-- ----------------------------------------------------------------------------
alter table contracts
  add column if not exists profit_distributed boolean not null default false;

alter table contracts
  add column if not exists profit_distributed_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security for Phase 2 tables (same staff-full-access pattern)
-- ----------------------------------------------------------------------------
alter table withdrawals enable row level security;

drop policy if exists staff_full_access on withdrawals;
create policy staff_full_access on withdrawals
  for all using (is_authenticated_staff()) with check (is_authenticated_staff());

-- investors / business_phases / investor_phase_investments / profit_distributions
-- already got staff_full_access policies in the Phase 1 migration's do-block
-- (it looped over an array that included them). Re-running is safe (drop+create).
do $$
declare
  t text;
begin
  foreach t in array array[
    'investors', 'business_phases',
    'investor_phase_investments', 'profit_distributions'
  ]
  loop
    execute format('drop policy if exists staff_full_access on %I;', t);
    execute format(
      'create policy staff_full_access on %I for all using (is_authenticated_staff()) with check (is_authenticated_staff());',
      t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Atomic profit distribution function
--
-- Runs entirely inside Postgres as one transaction:
--   1. Locks the contract row (FOR UPDATE) so concurrent calls can't
--      both pass the "not yet distributed" check.
--   2. Verifies the contract is COMPLETED and not already distributed.
--   3. Finds the active business phase (or the phase explicitly pinned
--      to the contract via contracts.phase_id, if set).
--   4. Sums that phase's investor_phase_investments.
--   5. If total investment is 0 (no investors funded this phase yet),
--      raises a clear error rather than silently distributing nothing
--      or dividing by zero.
--   6. Inserts one profit_distributions row per investor, amount =
--      contract profit * (investor's investment / total investment),
--      with the *last* investor (by id) absorbing any rounding remainder
--      so the distributed total always equals the contract's profit
--      exactly — no fractional paisa lost or duplicated.
--   7. Marks the contract as distributed.
--
-- Returns the set of distribution rows created.
-- ----------------------------------------------------------------------------
create or replace function distribute_contract_profit(p_contract_id bigint)
returns setof profit_distributions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
  v_phase_id bigint;
  v_total_investment numeric(14,2);
  v_profit numeric(12,2);
  v_investor record;
  v_running_total numeric(12,2) := 0;
  v_investor_count integer;
  v_index integer := 0;
  v_share numeric(12,2);
  v_new_row profit_distributions%rowtype;
begin
  -- Lock the contract row for the duration of this transaction.
  select * into v_contract from contracts where id = p_contract_id for update;

  if v_contract.id is null then
    raise exception 'Contract % not found', p_contract_id;
  end if;

  if v_contract.status <> 'COMPLETED' then
    raise exception 'Contract % is not completed (status=%) — profit cannot be distributed yet', p_contract_id, v_contract.status;
  end if;

  if v_contract.profit_distributed then
    raise exception 'Contract % has already had its profit distributed', p_contract_id;
  end if;

  -- Use the contract's pinned phase if set, otherwise the currently active phase.
  if v_contract.phase_id is not null then
    v_phase_id := v_contract.phase_id;
  else
    select id into v_phase_id
    from business_phases
    where status = 'ACTIVE'
    order by start_date desc
    limit 1;
  end if;

  if v_phase_id is null then
    raise exception 'No active business phase exists — cannot distribute profit for contract %. Create a business phase first.', p_contract_id;
  end if;

  select coalesce(sum(investment_amount), 0) into v_total_investment
  from investor_phase_investments
  where phase_id = v_phase_id;

  if v_total_investment <= 0 then
    raise exception 'Phase % has no investor investments — cannot distribute profit for contract %', v_phase_id, p_contract_id;
  end if;

  v_profit := v_contract.profit_amount;

  select count(*) into v_investor_count
  from investor_phase_investments
  where phase_id = v_phase_id;

  for v_investor in
    select investor_id, investment_amount
    from investor_phase_investments
    where phase_id = v_phase_id
    order by investor_id asc
  loop
    v_index := v_index + 1;

    if v_index = v_investor_count then
      -- Last investor absorbs the rounding remainder.
      v_share := round(v_profit - v_running_total, 2);
    else
      v_share := round(v_profit * (v_investor.investment_amount / v_total_investment), 2);
      v_running_total := v_running_total + v_share;
    end if;

    insert into profit_distributions (contract_id, phase_id, investor_id, profit_amount)
    values (p_contract_id, v_phase_id, v_investor.investor_id, v_share)
    returning * into v_new_row;

    return next v_new_row;
  end loop;

  update contracts
  set profit_distributed = true,
      profit_distributed_at = now(),
      phase_id = v_phase_id
  where id = p_contract_id;

  return;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Investor available-balance helper
-- available balance = total distributed to them - total withdrawn by them.
-- Exposed as a function rather than a view so it can be called per-investor
-- cheaply, and so withdrawal validation can reuse the exact same number
-- the UI displays (no drift between "what the UI shows" and "what's enforced").
-- ----------------------------------------------------------------------------
create or replace function investor_available_balance(p_investor_id bigint)
returns numeric(14,2)
language sql
stable
as $$
  select
    coalesce((select sum(profit_amount) from profit_distributions where investor_id = p_investor_id), 0)
    - coalesce((select sum(amount) from withdrawals where investor_id = p_investor_id), 0);
$$;

-- ============================================================================
-- End of Phase 2 migration.
-- ============================================================================
