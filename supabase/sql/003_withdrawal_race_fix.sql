-- ============================================================================
-- Sitara Traders — Phase 2 follow-up migration (003)
-- Run this AFTER 002_phase2_migration.sql.
--
-- Closes a race condition flagged in withdrawal-service.ts: the original
-- client-side flow read investor_available_balance() and then inserted
-- a withdrawal row as two separate round-trips, so two withdrawals
-- submitted at the same instant for the same investor could both read
-- the same "available" balance and both succeed, jointly overdrawing it.
--
-- This function does the read-check-write as one transaction with a
-- row lock, the same pattern distribute_contract_profit() already uses
-- for contracts. There's no dedicated row to lock for "an investor's
-- balance" (it's derived from distributions minus withdrawals across
-- two tables), so we lock the investor row itself via FOR UPDATE —
-- that's enough to serialize concurrent withdrawal attempts for the
-- same investor, since both transactions must acquire that lock before
-- they can proceed to the balance check.
-- ============================================================================

create or replace function create_withdrawal_with_balance_check(
  p_investor_id bigint,
  p_amount numeric(12,2),
  p_reason text,
  p_withdrawal_date date
)
returns setof withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_investor_exists boolean;
  v_available numeric(14,2);
  v_new_row withdrawals%rowtype;
begin
  if p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  -- Lock the investor row for the duration of this transaction so a
  -- concurrent withdrawal for the same investor must wait for this one
  -- to commit (or roll back) before it can read the balance.
  select exists(select 1 from investors where id = p_investor_id for update)
    into v_investor_exists;

  if not v_investor_exists then
    raise exception 'Investor % not found', p_investor_id;
  end if;

  v_available := investor_available_balance(p_investor_id);

  if p_amount > v_available then
    raise exception
      'Withdrawal of % exceeds available balance of %',
      p_amount, v_available;
  end if;

  insert into withdrawals (investor_id, amount, reason, withdrawal_date)
  values (p_investor_id, p_amount, p_reason, p_withdrawal_date)
  returning * into v_new_row;

  return next v_new_row;
  return;
end;
$$;

-- ============================================================================
-- End of migration 003.
-- ============================================================================
