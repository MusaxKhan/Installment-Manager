import type {
  ClientRow,
  ContractRow,
  InstallmentRow,
  PaymentRow,
  PaymentEditRow,
  InvestorRow,
  BusinessPhaseRow,
  InvestorPhaseInvestmentRow,
  ProfitDistributionRow,
  ContractInvestorSnapshotRow,
  BusinessExpenseRow,
  WithdrawalRow,
} from "@/types/database";
import type {
  Client,
  Contract,
  Installment,
  Payment,
  PaymentEdit,
  Investor,
  BusinessPhase,
  InvestorPhaseInvestment,
  ProfitDistribution,
  ContractInvestorSnapshot,
  BusinessExpense,
  Withdrawal,
} from "@/types/domain";

export function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    clientCode: row.client_code,
    name: row.name,
    cnic: row.cnic,
    phone: row.phone,
    address: row.address,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncVersion: row.sync_version,
  };
}

export function mapContract(row: ContractRow): Contract {
  const hasGuarantor = Boolean(
    row.guarantor_name || row.guarantor_phone || row.guarantor_cnic
  );

  return {
    id: row.id,
    contractCode: row.contract_code,
    clientId: row.client_id,
    productName: row.product_name,
    productDescription: row.product_description,
    initiatedBy: row.initiated_by,
    purchasePrice: Number(row.purchase_price),
    profitPercent: Number(row.profit_percent),
    profitAmount: Number(row.profit_amount),
    totalPrice: Number(row.total_price),
    numberOfInstallments: row.number_of_installments,
    amountPerInstallment: Number(row.amount_per_installment),
    remainingBalance: Number(row.remaining_balance),
    startDate: row.start_date,
    expectedEndDate: row.expected_end_date,
    status: row.status,
    overdueMonths: row.overdue_months,
    phaseId: row.phase_id,
    guarantor: hasGuarantor
      ? {
          name: row.guarantor_name,
          phone: row.guarantor_phone,
          address: row.guarantor_address,
          cnic: row.guarantor_cnic,
        }
      : null,
    profitDistributed: row.profit_distributed,
    profitDistributedAt: row.profit_distributed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncVersion: row.sync_version,
  };
}

export function mapInstallment(row: InstallmentRow): Installment {
  return {
    id: row.id,
    contractId: row.contract_id,
    installmentNumber: row.installment_number,
    dueDate: row.due_date,
    installmentAmount: Number(row.installment_amount),
    paidAmount: Number(row.paid_amount),
    remainingAmount: Number(row.remaining_amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    contractId: row.contract_id,
    amountPaid: Number(row.amount_paid),
    remainingBalance: Number(row.remaining_balance),
    paymentMethod: row.payment_method,
    remarks: row.remarks,
    paymentDate: row.payment_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncVersion: row.sync_version,
  };
}

export function mapPaymentEdit(row: PaymentEditRow): PaymentEdit {
  return {
    id: row.id,
    paymentId: row.payment_id,
    oldAmount: row.old_amount !== null ? Number(row.old_amount) : null,
    newAmount: row.new_amount !== null ? Number(row.new_amount) : null,
    reason: row.reason,
    editedBy: row.edited_by,
    editedAt: row.edited_at,
  };
}

export function mapInvestor(row: InvestorRow): Investor {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function mapBusinessPhase(row: BusinessPhaseRow): BusinessPhase {
  return {
    id: row.id,
    phaseName: row.phase_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapInvestorPhaseInvestment(
  row: InvestorPhaseInvestmentRow
): InvestorPhaseInvestment {
  return {
    id: row.id,
    phaseId: row.phase_id,
    investorId: row.investor_id,
    investmentAmount: Number(row.investment_amount),
    createdAt: row.created_at,
  };
}

export function mapProfitDistribution(
  row: ProfitDistributionRow
): ProfitDistribution {
  return {
    id: row.id,
    contractId: row.contract_id,
    phaseId: row.phase_id,
    investorId: row.investor_id,
    profitAmount: Number(row.profit_amount),
    createdAt: row.created_at,
  };
}

export function mapContractInvestorSnapshot(
  row: ContractInvestorSnapshotRow
): ContractInvestorSnapshot {
  return {
    id: row.id,
    contractId: row.contract_id,
    phaseId: row.phase_id,
    investorId: row.investor_id,
    investmentAmount: Number(row.investment_amount),
    percentOfPool: Number(row.percent_of_pool),
    createdAt: row.created_at,
  };
}

export function mapBusinessExpense(row: BusinessExpenseRow): BusinessExpense {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    expenseDate: row.expense_date,
    notes: row.notes,
    receiptReference: row.receipt_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWithdrawal(row: WithdrawalRow): Withdrawal {
  return {
    id: row.id,
    investorId: row.investor_id,
    amount: Number(row.amount),
    reason: row.reason,
    withdrawalDate: row.withdrawal_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncVersion: row.sync_version,
  };
}