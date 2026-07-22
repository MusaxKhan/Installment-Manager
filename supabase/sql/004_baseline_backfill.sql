-- ============================================================================
-- Sitara Traders — baseline schema backfill (004)
--
-- WHAT THIS FILE IS AND WHY IT EXISTS
-- ------------------------------------------------------------------------
-- You asked me to give you the migration files missing between 003 and
-- 006 so you could commit them. Checking the schema dump you provided
-- turned up something bigger than a couple of missing files: 13 of your
-- application tables (clients, contracts, installments, payments,
-- payment_edits, investors, business_phases, investor_phase_investments,
-- profit_distributions, contract_investor_snapshots, cash_ledger, loans,
-- business_expenses) were never created by ANY tracked migration —
-- they predate 001 entirely, set up directly against the database
-- before migration tracking started. Only user_profiles (001),
-- withdrawals (002), and contract_deletion_log (006) exist in git.
--
-- Same story for 7 functions: current_cash_in_hand, enforce_cash_floor,
-- get_database_size_bytes, snapshot_contract_investors, create_loan,
-- record_loan_repayment, and create_business_expense_with_balance_check
-- are all live in your database and referenced throughout the app code,
-- but none of them exist in supabase/sql/001-003.
--
-- This file is a straight reconstruction of all of the above, extracted
-- directly from the schema dump you provided (so it matches what's
-- actually live, not a guess). It is NOT something you should run
-- against your current database — every object in here already exists
-- there. Its only purpose is:
--   1. Filling the gap in git history, so the repo actually reflects
--      reality and future audits don't have to reconstruct it again.
--   2. Letting you stand up a fresh database (a staging environment,
--      disaster recovery, etc.) by running 001 → 002 → 003 → 004(this)
--      → 006 → 007 in order and ending up with the same schema you
--      have in production today.
--
-- I split loans/business_expenses out from the rest of the foundational
-- schema in the code comments I found ("migration 004", "migration
-- 005"), but I can't reconstruct the exact original boundary between
-- those two and everything else that predates 001 — there's no
-- timestamp or dependency information in a schema dump that tells you
-- when each piece was added. Rather than fabricate a false split, this
-- is one honest, complete file covering everything untracked.
-- ============================================================================

--
-- Name: business_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_expenses (
    id bigint NOT NULL,
    title text NOT NULL,
    amount numeric(12,2) NOT NULL,
    category text NOT NULL,
    expense_date date NOT NULL,
    notes text,
    receipt_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_expenses_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT business_expenses_category_check CHECK ((category = ANY (ARRAY['rent'::text, 'utilities'::text, 'salaries'::text, 'fuel_transport'::text, 'office_supplies'::text, 'maintenance_repair'::text, 'marketing'::text, 'taxes_fees'::text, 'other'::text])))
);

ALTER TABLE public.business_expenses OWNER TO postgres;

--
-- Name: create_business_expense_with_balance_check(text, numeric, text, date, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_business_expense_with_balance_check(p_title text, p_amount numeric, p_category text, p_expense_date date, p_notes text, p_receipt_reference text) RETURNS SETOF public.business_expenses
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  v_cash_in_hand numeric(14,2);

  v_new_expense business_expenses%rowtype;

begin

  if p_amount is null or p_amount <= 0 then

    raise exception 'Expense amount must be greater than zero';

  end if;

  if p_title is null or length(trim(p_title)) = 0 then

    raise exception 'Expense title is required';

  end if;

  -- Serializes against any other caller taking the same advisory lock

  -- for the duration of this transaction, so two expenses submitted at

  -- the same instant can't both read the same cash-in-hand figure and

  -- both pass the check.

  perform pg_advisory_xact_lock(hashtext('cash_ledger_balance_check'));

  v_cash_in_hand := current_cash_in_hand();

  if p_amount > v_cash_in_hand then

    raise exception

      'Insufficient cash in hand: available Rs. %, expense amount Rs. %',

      v_cash_in_hand, p_amount;

  end if;

  insert into business_expenses

    (title, amount, category, expense_date, notes, receipt_reference)

  values

    (trim(p_title), p_amount, p_category, p_expense_date, p_notes, p_receipt_reference)

  returning * into v_new_expense;

  insert into cash_ledger

    (entry_type, amount, business_expense_id, entry_date, description)

  values

    ('business_expense', -p_amount, v_new_expense.id, p_expense_date,

     'Business expense: ' || trim(p_title));

  return next v_new_expense;

end;

$$;

ALTER FUNCTION public.create_business_expense_with_balance_check(p_title text, p_amount numeric, p_category text, p_expense_date date, p_notes text, p_receipt_reference text) OWNER TO postgres;

--
-- Name: loans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loans (
    id bigint NOT NULL,
    lender_name text NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text,
    loan_date date DEFAULT CURRENT_DATE NOT NULL,
    amount_repaid numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sync_version integer DEFAULT 1,
    CONSTRAINT loans_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT loans_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'REPAID'::text])))
);

ALTER TABLE public.loans OWNER TO postgres;

--
-- Name: create_loan(text, numeric, text, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_loan(p_lender_name text, p_amount numeric, p_reason text, p_loan_date date) RETURNS SETOF public.loans
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  v_new_loan loans%rowtype;

begin

  if p_amount <= 0 then

    raise exception 'Loan amount must be greater than zero';

  end if;

  insert into loans (lender_name, amount, reason, loan_date)

  values (p_lender_name, p_amount, p_reason, p_loan_date)

  returning * into v_new_loan;

  insert into cash_ledger (entry_type, amount, loan_id, entry_date, description)

  values ('loan', p_amount, v_new_loan.id, p_loan_date, 'Loan from ' || p_lender_name);

  return next v_new_loan;

  return;

end;

$$;

ALTER FUNCTION public.create_loan(p_lender_name text, p_amount numeric, p_reason text, p_loan_date date) OWNER TO postgres;

--
-- Name: current_cash_in_hand(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_cash_in_hand() RETURNS numeric
    LANGUAGE sql STABLE
    AS $$

  select coalesce(sum(amount), 0) from cash_ledger;

$$;

ALTER FUNCTION public.current_cash_in_hand() OWNER TO postgres;

--
-- Name: profit_distributions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profit_distributions (
    id bigint NOT NULL,
    contract_id bigint,
    phase_id bigint,
    investor_id bigint,
    profit_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profit_distributions OWNER TO postgres;

--
-- Name: enforce_cash_floor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_cash_floor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

declare

  v_balance_after numeric(14,2);

begin

  if new.entry_type in ('withdrawal', 'loan_repayment') then

    select coalesce(sum(amount), 0) + new.amount into v_balance_after

    from cash_ledger;

    if v_balance_after < 0 then

      raise exception

        'This % of % would take cash in hand below zero (resulting balance: %). Rejected.',

        new.entry_type, abs(new.amount), v_balance_after;

    end if;

  end if;

  return new;

end;

$$;

ALTER FUNCTION public.enforce_cash_floor() OWNER TO postgres;

--
-- Name: get_database_size_bytes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_database_size_bytes() RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

  select pg_database_size(current_database());

$$;

ALTER FUNCTION public.get_database_size_bytes() OWNER TO postgres;

--
-- Name: record_loan_repayment(bigint, numeric, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_loan_repayment(p_loan_id bigint, p_amount numeric, p_repayment_date date) RETURNS SETOF public.loans
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  v_loan loans%rowtype;

  v_outstanding numeric(14,2);

  v_cash_available numeric(14,2);

  v_updated loans%rowtype;

begin

  if p_amount <= 0 then

    raise exception 'Repayment amount must be greater than zero';

  end if;

  select * into v_loan from loans where id = p_loan_id for update;

  if v_loan.id is null then

    raise exception 'Loan % not found', p_loan_id;

  end if;

  v_outstanding := v_loan.amount - v_loan.amount_repaid;

  if p_amount > v_outstanding then

    raise exception 'Repayment of % exceeds outstanding loan balance of %', p_amount, v_outstanding;

  end if;

  -- NEW: cash-in-hand check, same reasoning as withdrawals — you can't

  -- pay out cash the business doesn't actually have, regardless of how

  -- much is still owed on the loan itself.

  v_cash_available := current_cash_in_hand();

  if p_amount > v_cash_available then

    raise exception

      'Repayment of % exceeds current cash in hand (%). The business does not have enough free cash to repay this right now.',

      p_amount, v_cash_available;

  end if;

  update loans

  set amount_repaid = amount_repaid + p_amount,

      status = case when amount_repaid + p_amount >= amount then 'REPAID' else 'ACTIVE' end

  where id = p_loan_id

  returning * into v_updated;

  insert into cash_ledger (entry_type, amount, loan_id, entry_date, description)

  values ('loan_repayment', -p_amount, p_loan_id, p_repayment_date, 'Repayment toward loan from ' || v_loan.lender_name);

  return next v_updated;

  return;

end;

$$;

ALTER FUNCTION public.record_loan_repayment(p_loan_id bigint, p_amount numeric, p_repayment_date date) OWNER TO postgres;

--
-- Name: snapshot_contract_investors(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.snapshot_contract_investors(p_contract_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  v_contract contracts%rowtype;

  v_phase_id bigint;

  v_total_investment numeric(14,2);

  v_existing_count integer;

begin

  select * into v_contract from contracts where id = p_contract_id for update;

  if v_contract.id is null then

    raise exception 'Contract % not found', p_contract_id;

  end if;

  select count(*) into v_existing_count

  from contract_investor_snapshots

  where contract_id = p_contract_id;

  if v_existing_count > 0 then

    -- Already snapshotted — never overwrite an existing snapshot.

    return;

  end if;

  -- Use the contract's own phase if one is already pinned (e.g. re-running

  -- the backfill), otherwise whichever phase is active right now, which is

  -- what "the current investor pool" means at contract-creation time.

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

    raise exception 'No active business phase exists — create a business phase with investor investments before creating a contract.';

  end if;

  select coalesce(sum(investment_amount), 0) into v_total_investment

  from investor_phase_investments

  where phase_id = v_phase_id;

  if v_total_investment <= 0 then

    raise exception 'The active business phase has no investor investments — add investor capital before creating a contract.';

  end if;

  insert into contract_investor_snapshots

    (contract_id, phase_id, investor_id, investment_amount, percent_of_pool)

  select

    p_contract_id,

    v_phase_id,

    ipi.investor_id,

    ipi.investment_amount,

    round(ipi.investment_amount / v_total_investment * 100, 6)

  from investor_phase_investments ipi

  where ipi.phase_id = v_phase_id;

  update contracts

  set phase_id = v_phase_id

  where id = p_contract_id;

end;

$$;

ALTER FUNCTION public.snapshot_contract_investors(p_contract_id bigint) OWNER TO postgres;

--
-- Name: business_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.business_expenses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.business_expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: business_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_phases (
    id bigint NOT NULL,
    phase_name text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status text DEFAULT 'ACTIVE'::text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.business_phases OWNER TO postgres;

--
-- Name: business_phases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.business_phases ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.business_phases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: cash_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_ledger (
    id bigint NOT NULL,
    entry_type text NOT NULL,
    amount numeric(14,2) NOT NULL,
    contract_id bigint,
    investor_id bigint,
    investment_id bigint,
    loan_id bigint,
    withdrawal_id bigint,
    description text,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    payment_id bigint,
    business_expense_id bigint,
    CONSTRAINT cash_ledger_entry_type_check CHECK ((entry_type = ANY (ARRAY['investment'::text, 'loan'::text, 'payment_received'::text, 'purchase'::text, 'withdrawal'::text, 'loan_repayment'::text, 'business_expense'::text])))
);

ALTER TABLE public.cash_ledger OWNER TO postgres;

--
-- Name: cash_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cash_ledger ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cash_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id bigint NOT NULL,
    client_code text NOT NULL,
    name text NOT NULL,
    cnic text,
    phone text,
    address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sync_version integer DEFAULT 1,
    is_deleted boolean DEFAULT false NOT NULL
);

ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: contract_investor_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_investor_snapshots (
    id bigint NOT NULL,
    contract_id bigint NOT NULL,
    phase_id bigint NOT NULL,
    investor_id bigint NOT NULL,
    investment_amount numeric(14,2) NOT NULL,
    percent_of_pool numeric(9,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.contract_investor_snapshots OWNER TO postgres;

--
-- Name: contract_investor_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_investor_snapshots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contract_investor_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id bigint NOT NULL,
    contract_code text NOT NULL,
    client_id bigint NOT NULL,
    product_name text NOT NULL,
    initiated_by text NOT NULL,
    purchase_price numeric(12,2) NOT NULL,
    profit_percent numeric(5,2) NOT NULL,
    profit_amount numeric(12,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    number_of_installments integer NOT NULL,
    amount_per_installment numeric(12,2) NOT NULL,
    remaining_balance numeric(12,2) NOT NULL,
    start_date date NOT NULL,
    expected_end_date date,
    status text DEFAULT 'ACTIVE'::text,
    created_at timestamp with time zone DEFAULT now(),
    overdue_months integer DEFAULT 0,
    phase_id bigint,
    updated_at timestamp with time zone DEFAULT now(),
    sync_version integer DEFAULT 1,
    guarantor_name text,
    guarantor_phone text,
    guarantor_address text,
    guarantor_cnic text,
    product_description text,
    profit_distributed boolean DEFAULT false NOT NULL,
    profit_distributed_at timestamp with time zone
);

ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.contracts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contracts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: installments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.installments (
    id bigint NOT NULL,
    contract_id bigint NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    installment_amount numeric(12,2) NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0,
    remaining_amount numeric(12,2) NOT NULL,
    status text DEFAULT 'PENDING'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.installments OWNER TO postgres;

--
-- Name: installments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.installments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.installments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: investor_phase_investments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investor_phase_investments (
    id bigint NOT NULL,
    phase_id bigint,
    investor_id bigint,
    investment_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.investor_phase_investments OWNER TO postgres;

--
-- Name: investor_phase_investments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.investor_phase_investments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.investor_phase_investments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: investors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investors (
    id bigint NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.investors OWNER TO postgres;

--
-- Name: investors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.investors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.investors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: loans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.loans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.loans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: payment_edits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_edits (
    id bigint NOT NULL,
    payment_id bigint,
    old_amount numeric(12,2),
    new_amount numeric(12,2),
    reason text,
    edited_by text,
    edited_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_edits OWNER TO postgres;

--
-- Name: payment_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_edits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payment_edits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    contract_id bigint NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    remaining_balance numeric(12,2) NOT NULL,
    payment_method text,
    remarks text,
    payment_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sync_version integer DEFAULT 1
);

ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: profit_distributions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.profit_distributions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.profit_distributions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: business_expenses business_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_expenses
    ADD CONSTRAINT business_expenses_pkey PRIMARY KEY (id);

--
-- Name: business_phases business_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_phases
    ADD CONSTRAINT business_phases_pkey PRIMARY KEY (id);

--
-- Name: cash_ledger cash_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_pkey PRIMARY KEY (id);

--
-- Name: clients clients_client_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_client_code_key UNIQUE (client_code);

--
-- Name: clients clients_cnic_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_cnic_unique UNIQUE (cnic);

--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

--
-- Name: contract_investor_snapshots contract_investor_snapshots_contract_id_investor_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_investor_snapshots
    ADD CONSTRAINT contract_investor_snapshots_contract_id_investor_id_key UNIQUE (contract_id, investor_id);

--
-- Name: contract_investor_snapshots contract_investor_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_investor_snapshots
    ADD CONSTRAINT contract_investor_snapshots_pkey PRIMARY KEY (id);

--
-- Name: contracts contracts_contract_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_code_key UNIQUE (contract_code);

--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);

--
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);

--
-- Name: investor_phase_investments investor_phase_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_phase_investments
    ADD CONSTRAINT investor_phase_investments_pkey PRIMARY KEY (id);

--
-- Name: investors investors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investors
    ADD CONSTRAINT investors_pkey PRIMARY KEY (id);

--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);

--
-- Name: payment_edits payment_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_edits
    ADD CONSTRAINT payment_edits_pkey PRIMARY KEY (id);

--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

--
-- Name: profit_distributions profit_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_pkey PRIMARY KEY (id);

--
-- Name: idx_business_expenses_expense_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_business_expenses_expense_date ON public.business_expenses USING btree (expense_date DESC);

--
-- Name: idx_cash_ledger_entry_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_ledger_entry_date ON public.cash_ledger USING btree (entry_date);

--
-- Name: idx_cash_ledger_entry_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_ledger_entry_type ON public.cash_ledger USING btree (entry_type);

--
-- Name: idx_cash_ledger_payment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_ledger_payment_id ON public.cash_ledger USING btree (payment_id);

--
-- Name: idx_contract_investor_snapshots_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_investor_snapshots_contract ON public.contract_investor_snapshots USING btree (contract_id);

--
-- Name: cash_ledger trg_cash_ledger_floor; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cash_ledger_floor BEFORE INSERT ON public.cash_ledger FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_floor();

--
-- Name: clients trg_clients_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

--
-- Name: contracts trg_contracts_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_contracts_touch BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

--
-- Name: installments trg_installments_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_installments_touch BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_only();

--
-- Name: loans trg_loans_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_loans_touch BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

--
-- Name: payments trg_payments_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

--
-- Name: cash_ledger cash_ledger_business_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_business_expense_id_fkey FOREIGN KEY (business_expense_id) REFERENCES public.business_expenses(id);

--
-- Name: cash_ledger cash_ledger_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;

--
-- Name: cash_ledger cash_ledger_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investor_phase_investments(id) ON DELETE SET NULL;

--
-- Name: cash_ledger cash_ledger_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE SET NULL;

--
-- Name: cash_ledger cash_ledger_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE SET NULL;

--
-- Name: cash_ledger cash_ledger_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

--
-- Name: cash_ledger cash_ledger_withdrawal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_ledger
    ADD CONSTRAINT cash_ledger_withdrawal_id_fkey FOREIGN KEY (withdrawal_id) REFERENCES public.withdrawals(id) ON DELETE SET NULL;

--
-- Name: contract_investor_snapshots contract_investor_snapshots_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_investor_snapshots
    ADD CONSTRAINT contract_investor_snapshots_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

--
-- Name: contract_investor_snapshots contract_investor_snapshots_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_investor_snapshots
    ADD CONSTRAINT contract_investor_snapshots_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id);

--
-- Name: contract_investor_snapshots contract_investor_snapshots_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_investor_snapshots
    ADD CONSTRAINT contract_investor_snapshots_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.business_phases(id);

--
-- Name: contracts contracts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

--
-- Name: contracts contracts_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.business_phases(id);

--
-- Name: installments installments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

--
-- Name: investor_phase_investments investor_phase_investments_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_phase_investments
    ADD CONSTRAINT investor_phase_investments_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE CASCADE;

--
-- Name: investor_phase_investments investor_phase_investments_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_phase_investments
    ADD CONSTRAINT investor_phase_investments_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.business_phases(id) ON DELETE CASCADE;

--
-- Name: payment_edits payment_edits_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_edits
    ADD CONSTRAINT payment_edits_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;

--
-- Name: payments payments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

--
-- Name: profit_distributions profit_distributions_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

--
-- Name: profit_distributions profit_distributions_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id);

--
-- Name: profit_distributions profit_distributions_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.business_phases(id);

--
-- Name: business_expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: business_phases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.business_phases ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cash_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_investor_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_investor_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: installments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

--
-- Name: investor_phase_investments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.investor_phase_investments ENABLE ROW LEVEL SECURITY;

--
-- Name: investors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

--
-- Name: loans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_edits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_edits ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profit_distributions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profit_distributions ENABLE ROW LEVEL SECURITY;

--
-- Name: business_expenses staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.business_expenses USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: business_phases staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.business_phases USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: cash_ledger staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.cash_ledger USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: clients staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.clients USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: contract_investor_snapshots staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.contract_investor_snapshots USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: contracts staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.contracts USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: installments staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.installments USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: investor_phase_investments staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.investor_phase_investments USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: investors staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.investors USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: loans staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.loans USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: payment_edits staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.payment_edits USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: payments staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.payments USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: profit_distributions staff_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY staff_full_access ON public.profit_distributions USING (public.is_authenticated_staff()) WITH CHECK (public.is_authenticated_staff());

--
-- Name: TABLE business_expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.business_expenses TO anon;
GRANT ALL ON TABLE public.business_expenses TO authenticated;
GRANT ALL ON TABLE public.business_expenses TO service_role;

--
-- Name: FUNCTION create_business_expense_with_balance_check(p_title text, p_amount numeric, p_category text, p_expense_date date, p_notes text, p_receipt_reference text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_business_expense_with_balance_check(p_title text, p_amount numeric, p_category text, p_expense_date date, p_notes text, p_receipt_reference text) TO anon;
GRANT ALL ON FUNCTION public.create_business_expense_with_balance_check(p_title text, p_amount numeric, p_category text, p_expense_date date, p_notes text, p_receipt_reference text) TO authenticated;
GRANT ALL ON FUNCTION public.create_business_expense_with_balance_check(p_title text, p_amount numeric, p_category text, p_expense_date date, p_notes text, p_receipt_reference text) TO service_role;

--
-- Name: TABLE loans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loans TO anon;
GRANT ALL ON TABLE public.loans TO authenticated;
GRANT ALL ON TABLE public.loans TO service_role;

--
-- Name: FUNCTION create_loan(p_lender_name text, p_amount numeric, p_reason text, p_loan_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_loan(p_lender_name text, p_amount numeric, p_reason text, p_loan_date date) TO anon;
GRANT ALL ON FUNCTION public.create_loan(p_lender_name text, p_amount numeric, p_reason text, p_loan_date date) TO authenticated;
GRANT ALL ON FUNCTION public.create_loan(p_lender_name text, p_amount numeric, p_reason text, p_loan_date date) TO service_role;

--
-- Name: FUNCTION current_cash_in_hand(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_cash_in_hand() TO anon;
GRANT ALL ON FUNCTION public.current_cash_in_hand() TO authenticated;
GRANT ALL ON FUNCTION public.current_cash_in_hand() TO service_role;

--
-- Name: TABLE profit_distributions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profit_distributions TO anon;
GRANT ALL ON TABLE public.profit_distributions TO authenticated;
GRANT ALL ON TABLE public.profit_distributions TO service_role;

--
-- Name: FUNCTION enforce_cash_floor(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enforce_cash_floor() TO anon;
GRANT ALL ON FUNCTION public.enforce_cash_floor() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_cash_floor() TO service_role;

--
-- Name: FUNCTION get_database_size_bytes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_database_size_bytes() TO anon;
GRANT ALL ON FUNCTION public.get_database_size_bytes() TO authenticated;
GRANT ALL ON FUNCTION public.get_database_size_bytes() TO service_role;

--
-- Name: FUNCTION record_loan_repayment(p_loan_id bigint, p_amount numeric, p_repayment_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.record_loan_repayment(p_loan_id bigint, p_amount numeric, p_repayment_date date) TO anon;
GRANT ALL ON FUNCTION public.record_loan_repayment(p_loan_id bigint, p_amount numeric, p_repayment_date date) TO authenticated;
GRANT ALL ON FUNCTION public.record_loan_repayment(p_loan_id bigint, p_amount numeric, p_repayment_date date) TO service_role;

--
-- Name: FUNCTION snapshot_contract_investors(p_contract_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.snapshot_contract_investors(p_contract_id bigint) TO anon;
GRANT ALL ON FUNCTION public.snapshot_contract_investors(p_contract_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.snapshot_contract_investors(p_contract_id bigint) TO service_role;

--
-- Name: SEQUENCE business_expenses_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.business_expenses_id_seq TO anon;
GRANT ALL ON SEQUENCE public.business_expenses_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.business_expenses_id_seq TO service_role;

--
-- Name: TABLE business_phases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.business_phases TO anon;
GRANT ALL ON TABLE public.business_phases TO authenticated;
GRANT ALL ON TABLE public.business_phases TO service_role;

--
-- Name: SEQUENCE business_phases_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.business_phases_id_seq TO anon;
GRANT ALL ON SEQUENCE public.business_phases_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.business_phases_id_seq TO service_role;

--
-- Name: TABLE cash_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cash_ledger TO anon;
GRANT ALL ON TABLE public.cash_ledger TO authenticated;
GRANT ALL ON TABLE public.cash_ledger TO service_role;

--
-- Name: SEQUENCE cash_ledger_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cash_ledger_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cash_ledger_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cash_ledger_id_seq TO service_role;

--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;

--
-- Name: SEQUENCE clients_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.clients_id_seq TO anon;
GRANT ALL ON SEQUENCE public.clients_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.clients_id_seq TO service_role;

--
-- Name: TABLE contract_investor_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_investor_snapshots TO anon;
GRANT ALL ON TABLE public.contract_investor_snapshots TO authenticated;
GRANT ALL ON TABLE public.contract_investor_snapshots TO service_role;

--
-- Name: SEQUENCE contract_investor_snapshots_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contract_investor_snapshots_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contract_investor_snapshots_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contract_investor_snapshots_id_seq TO service_role;

--
-- Name: TABLE contracts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contracts TO anon;
GRANT ALL ON TABLE public.contracts TO authenticated;
GRANT ALL ON TABLE public.contracts TO service_role;

--
-- Name: SEQUENCE contracts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contracts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contracts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contracts_id_seq TO service_role;

--
-- Name: TABLE installments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.installments TO anon;
GRANT ALL ON TABLE public.installments TO authenticated;
GRANT ALL ON TABLE public.installments TO service_role;

--
-- Name: SEQUENCE installments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.installments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.installments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.installments_id_seq TO service_role;

--
-- Name: TABLE investor_phase_investments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.investor_phase_investments TO anon;
GRANT ALL ON TABLE public.investor_phase_investments TO authenticated;
GRANT ALL ON TABLE public.investor_phase_investments TO service_role;

--
-- Name: SEQUENCE investor_phase_investments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.investor_phase_investments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.investor_phase_investments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.investor_phase_investments_id_seq TO service_role;

--
-- Name: TABLE investors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.investors TO anon;
GRANT ALL ON TABLE public.investors TO authenticated;
GRANT ALL ON TABLE public.investors TO service_role;

--
-- Name: SEQUENCE investors_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.investors_id_seq TO anon;
GRANT ALL ON SEQUENCE public.investors_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.investors_id_seq TO service_role;

--
-- Name: SEQUENCE loans_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.loans_id_seq TO anon;
GRANT ALL ON SEQUENCE public.loans_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.loans_id_seq TO service_role;

--
-- Name: TABLE payment_edits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_edits TO anon;
GRANT ALL ON TABLE public.payment_edits TO authenticated;
GRANT ALL ON TABLE public.payment_edits TO service_role;

--
-- Name: SEQUENCE payment_edits_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payment_edits_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_edits_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_edits_id_seq TO service_role;

--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;

--
-- Name: SEQUENCE payments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payments_id_seq TO service_role;

--
-- Name: SEQUENCE profit_distributions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.profit_distributions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.profit_distributions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.profit_distributions_id_seq TO service_role;

