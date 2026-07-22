-- ============================================================================
-- Sitara Traders — follow-up migration (007)
-- Run this AFTER 006_contract_deletion.sql.
--
-- Hardens delete_contract() with two fixes discovered by reviewing the
-- real live schema (schema dump), not just the tracked migrations:
--
--   1. trg_cash_ledger_floor (enforce_cash_floor()) only fires on
--      INSERT into cash_ledger — it protects against a withdrawal or
--      loan repayment that would take cash-in-hand negative, but does
--      nothing for a DELETE. delete_contract()'s "fully undo" path
--      (p_reverse_cash = true) deletes cash_ledger rows outright,
--      completely unguarded by that trigger. If a client's payment was
--      received and that cash has since been spent elsewhere (a loan
--      repayment, a withdrawal, a business expense), reversing the
--      contract afterwards could silently take cash-in-hand negative.
--      This migration adds the same floor check directly inside
--      delete_contract() for that path.
--
--   2. Defense in depth: the block on deleting a contract whose profit
--      has already been distributed previously only checked the
--      contracts.profit_distributed boolean flag. distribute_contract_
--      profit() sets that flag atomically alongside inserting the
--      profit_distributions rows, so in normal operation they can't
--      drift apart — but profit_distributions also has
--      ON DELETE CASCADE from contracts, so if the flag and the rows
--      were ever out of sync for any reason, the block could be
--      silently bypassed and cascade-delete real distribution records.
--      This migration checks for the rows' existence directly, in
--      addition to the flag.
-- ============================================================================

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
  v_cash_delta numeric(14,2);
  v_balance_after numeric(14,2);
begin
  if not is_admin() then
    raise exception 'Deleting a contract requires admin privileges.';
  end if;

  v_actor_id := auth.uid();
  select email into v_actor_email from user_profiles where id = v_actor_id;

  select * into v_contract from contracts where id = p_contract_id for update;

  if v_contract.id is null then
    raise exception 'Contract % not found', p_contract_id;
  end if;

  if v_contract.status = 'COMPLETED' and v_contract.profit_distributed then
    raise exception
      'Contract % has already had its profit distributed to investors and cannot be deleted. Reverse the distribution manually first if this contract must be removed.',
      p_contract_id;
  end if;

  -- Belt-and-suspenders: check the actual rows, not just the flag.
  if exists (select 1 from profit_distributions where contract_id = p_contract_id) then
    raise exception
      'Contract % has profit distribution records and cannot be deleted, even though profit_distributed reads false on the contract row. Investigate this inconsistency before deleting.',
      p_contract_id;
  end if;

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

  if p_reverse_cash then
    -- enforce_cash_floor() only guards INSERTs of withdrawal/loan_repayment
    -- rows — it has no say over this DELETE. Check the same thing
    -- ourselves: don't let reversing this contract's cash take
    -- cash-in-hand below zero, which would mean some of this money has
    -- already been spent or withdrawn elsewhere.
    select coalesce(sum(amount), 0) into v_cash_delta
    from cash_ledger where contract_id = p_contract_id;

    v_balance_after := current_cash_in_hand() - v_cash_delta;

    if v_balance_after < 0 then
      raise exception
        'Reversing contract %''s cash would take cash-in-hand below zero (resulting balance: %). Some of this money has likely already been spent or withdrawn elsewhere — choose "keep cash history" instead, or resolve the shortfall first.',
        p_contract_id, v_balance_after;
    end if;

    delete from cash_ledger where contract_id = p_contract_id;
  else
    update cash_ledger
    set contract_id = null,
        description = trim(both ' ' from coalesce(description, '') ||
          ' [contract ' || v_contract.contract_code || ' deleted — cash history preserved]')
    where contract_id = p_contract_id;
  end if;

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
-- End of migration 007.
-- ============================================================================
