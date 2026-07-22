-- ============================================================================
-- Sitara Traders — follow-up migration (006)
-- Run this AFTER whatever migration your live database is actually on — see note below. This repo's tracked migrations only go up to 003, but the live schema clearly already has more (loans, business_expenses, cash_ledger.payment_id, etc. all referenced in application code with no matching migration file in this repo). Check your Supabase migration history before running.
--
-- Adds contract deletion:
--   1. contract_deletion_log — an append-only audit table. Every delete
--      writes a full JSON snapshot of the contract + its installments +
--      payments + payment_edits + cash_ledger rows + investor snapshot
--      BEFORE anything is removed, so a mistaken delete is always
--      reconstructable even though the delete itself is a hard delete.
--   2. delete_contract(p_contract_id, p_reverse_cash) — one atomic,
--      row-locked transaction (same pattern as distribute_contract_profit)
--      that removes a contract and everything that points at it, in the
--      correct dependency order, and decides what happens to cash-in-hand
--      based on p_reverse_cash:
--        - true  ("full undo"): delete the contract's cash_ledger rows
--          entirely (purchase + every payment_received tied to it).
--          Cash-in-hand goes back to what it would have been if this
--          contract never existed.
--        - false ("keep cash history"): the cash_ledger rows are kept
--          (so cash-in-hand and historical totals are unaffected) but
--          detached from the contract (contract_id set to null, since
--          the contract row is about to stop existing) and annotated.
--   Blocks deletion outright for COMPLETED contracts whose profit has
--   already been distributed — see comment on the function for why.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Audit log
-- ----------------------------------------------------------------------------
create table if not exists contract_deletion_log (
  id bigint generated always as identity primary key,

  contract_id bigint not null,
  contract_code text not null,
  client_id bigint,

  cash_reversed boolean not null,
  deleted_by uuid references user_profiles(id) on delete set null,
  deleted_by_email text,

  -- Full pre-delete snapshot: contract row + installments + payments +
  -- payment_edits + cash_ledger rows + investor snapshot, each as a
  -- jsonb array/object. This is the only way to recover what a hard
  -- delete removed.
  snapshot jsonb not null,

  created_at timestamptz default now()
);

alter table contract_deletion_log enable row level security;

drop policy if exists staff_read on contract_deletion_log;
create policy staff_read on contract_deletion_log
  for select using (is_authenticated_staff());

-- Only ever written by delete_contract() below, which runs as
-- security definer, so no direct-insert policy is needed for staff.

-- ----------------------------------------------------------------------------
-- 2. Atomic contract deletion
-- ----------------------------------------------------------------------------
create or replace function delete_contract(
  p_contract_id bigint,
  p_reverse_cash boolean
)
returns contract_deletion_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
  v_actor_id uuid;
  v_actor_email text;
  v_snapshot jsonb;
  v_log_row contract_deletion_log%rowtype;
begin
  if not is_admin() then
    raise exception 'Deleting a contract requires admin privileges.';
  end if;

  v_actor_id := auth.uid();
  select email into v_actor_email from user_profiles where id = v_actor_id;

  -- Lock the contract row for the duration of this transaction so a
  -- concurrent payment/edit/distribution can't race with the delete.
  select * into v_contract from contracts where id = p_contract_id for update;

  if v_contract.id is null then
    raise exception 'Contract % not found', p_contract_id;
  end if;

  -- The one case this function refuses outright: profit from this
  -- contract has already been split among investors via
  -- profit_distributions, and investors may already have withdrawn
  -- against it (investor_available_balance is a live sum of
  -- distributions minus withdrawals — there is no way to safely claw
  -- back cash that has already left through a withdrawal). Deleting
  -- the contract here would silently corrupt investor balances.
  if v_contract.status = 'COMPLETED' and v_contract.profit_distributed then
    raise exception
      'Contract % has already had its profit distributed to investors and cannot be deleted. Reverse the distribution manually first if this contract must be removed.',
      p_contract_id;
  end if;

  -- Build the full pre-delete snapshot before touching anything.
  select jsonb_build_object(
    'contract', to_jsonb(v_contract),
    'installments', coalesce(
      (select jsonb_agg(to_jsonb(i)) from installments i where i.contract_id = p_contract_id),
      '[]'::jsonb
    ),
    'payments', coalesce(
      (select jsonb_agg(to_jsonb(p)) from payments p where p.contract_id = p_contract_id),
      '[]'::jsonb
    ),
    'payment_edits', coalesce(
      (select jsonb_agg(to_jsonb(pe))
       from payment_edits pe
       where pe.payment_id in (select id from payments where contract_id = p_contract_id)),
      '[]'::jsonb
    ),
    'cash_ledger', coalesce(
      (select jsonb_agg(to_jsonb(cl)) from cash_ledger cl where cl.contract_id = p_contract_id),
      '[]'::jsonb
    ),
    'investor_snapshot', coalesce(
      (select jsonb_agg(to_jsonb(s)) from contract_investor_snapshots s where s.contract_id = p_contract_id),
      '[]'::jsonb
    )
  ) into v_snapshot;

  -- Cash-in-hand handling.
  if p_reverse_cash then
    delete from cash_ledger where contract_id = p_contract_id;
  else
    update cash_ledger
    set contract_id = null,
        description = trim(both ' ' from coalesce(description, '') ||
          ' [contract ' || v_contract.contract_code || ' deleted — cash history preserved]')
    where contract_id = p_contract_id;
  end if;

  -- Dependency order: payment_edits -> payments -> installments ->
  -- investor snapshot -> contract itself.
  delete from payment_edits
  where payment_id in (select id from payments where contract_id = p_contract_id);

  delete from payments where contract_id = p_contract_id;
  delete from installments where contract_id = p_contract_id;
  delete from contract_investor_snapshots where contract_id = p_contract_id;
  delete from contracts where id = p_contract_id;

  insert into contract_deletion_log (
    contract_id, contract_code, client_id,
    cash_reversed, deleted_by, deleted_by_email, snapshot
  )
  values (
    p_contract_id, v_contract.contract_code, v_contract.client_id,
    p_reverse_cash, v_actor_id, v_actor_email, v_snapshot
  )
  returning * into v_log_row;

  return v_log_row;
end;
$$;

-- ============================================================================
-- End of migration 006.
-- ============================================================================
