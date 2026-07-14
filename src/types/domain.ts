/**
 * Domain types — camelCase, app-facing shapes used throughout the UI.
 * Mapping to/from DB rows happens in src/lib/services/*.
 */

import type {
  ContractStatus,
  InstallmentStatus,
  PaymentMethod,
  PhaseStatus,
  UserRole,
} from "./database";

export type {
  ContractStatus,
  InstallmentStatus,
  PaymentMethod,
  PhaseStatus,
  UserRole,
};

export interface Client {
  id: number;
  clientCode: string;
  name: string;
  cnic: string | null;
  phone: string | null;
  address: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  syncVersion: number;
}

export interface ClientWithBlacklistStatus extends Client {
  /** True if any of this client's contracts has been overdue 3+ months */
  isBlacklisted: boolean;
  /** The longest overdue streak across all of this client's contracts, in months */
  maxOverdueMonths: number;
}

export interface ClientWithContracts extends Client {
  contracts: Contract[];
}

export interface Guarantor {
  name: string | null;
  phone: string | null;
  address: string | null;
  cnic: string | null;
}

export interface Contract {
  id: number;
  contractCode: string;
  clientId: number;
  productName: string;
  productDescription: string | null;
  initiatedBy: string;
  purchasePrice: number;
  profitPercent: number;
  profitAmount: number;
  totalPrice: number;
  numberOfInstallments: number;
  amountPerInstallment: number;
  remainingBalance: number;
  startDate: string;
  expectedEndDate: string | null;
  status: ContractStatus;
  overdueMonths: number;
  phaseId: number | null;
  guarantor: Guarantor | null;
  profitDistributed: boolean;
  profitDistributedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncVersion: number;
}

export interface ContractWithClient extends Contract {
  client: Pick<Client, "id" | "clientCode" | "name" | "phone">;
}

export interface ContractWithDetails extends Contract {
  client: Client;
  installments: Installment[];
  payments: Payment[];
}

export interface Installment {
  id: number;
  contractId: number;
  installmentNumber: number;
  dueDate: string;
  installmentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  contractId: number;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: PaymentMethod | null;
  remarks: string | null;
  paymentDate: string;
  createdAt: string;
  updatedAt: string;
  syncVersion: number;
}

export interface PaymentEdit {
  id: number;
  paymentId: number;
  oldAmount: number | null;
  newAmount: number | null;
  reason: string | null;
  editedBy: string | null;
  editedAt: string;
}

export interface PaymentWithEdits extends Payment {
  edits: PaymentEdit[];
}

// ── Auth / user profile ──

export interface UserProfile {
  id: string; // matches auth.users.id (uuid)
  email: string;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
}

// ── Dashboard aggregate ──

export interface DashboardStats {
  totalActiveContracts: number;
  totalOutstandingAmount: number;
  totalOverdueContracts: number;
  totalClients: number;
  totalInvestors: number;
  totalProfitGenerated: number;
  totalProfitDistributed: number;
  activePhaseInvestmentTotal: number;
  cashInHand: number;
  totalOutstandingLoans: number;
  totalCompletedContracts: number;
}

// ── Search ──

export type SearchResultType = "client" | "contract" | "investor";

export interface SearchResult {
  type: SearchResultType;
  id: number;
  title: string;
  subtitle: string;
  href: string;
}

// ── Investors (Phase 2) ──

export interface Investor {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface InvestorWithBalance extends Investor {
  totalInvested: number;
  totalDistributed: number;
  totalWithdrawn: number;
  availableBalance: number;
}

// ── Business Phases (Phase 2) ──

export interface BusinessPhase {
  id: number;
  phaseName: string;
  startDate: string;
  endDate: string | null;
  status: PhaseStatus;
  createdAt: string;
}

export interface BusinessPhaseWithTotals extends BusinessPhase {
  totalInvestment: number;
  investorCount: number;
}

// ── Investor Phase Investments (Phase 2) ──

export interface InvestorPhaseInvestment {
  id: number;
  phaseId: number;
  investorId: number;
  investmentAmount: number;
  createdAt: string;
}

export interface InvestorPhaseInvestmentWithPercent
  extends InvestorPhaseInvestment {
  /** Calculated dynamically — never stored. investmentAmount / phase total * 100 */
  percentOfPhase: number;
  investorName: string;
}

// ── Profit Distributions (Phase 2) ──

export interface ProfitDistribution {
  id: number;
  contractId: number;
  phaseId: number | null;
  investorId: number | null;
  profitAmount: number;
  createdAt: string;
}

export interface ProfitDistributionWithDetails extends ProfitDistribution {
  investorName: string;
  contractCode: string;
  phaseName: string | null;
}

// ── Contract Investor Snapshots (Phase 4) ──
// Frozen at the moment a contract is created: who was funding the active
// phase then, and how much. Distribution always uses this, never the live
// investor_phase_investments table, so later investors (or later top-ups by
// existing investors) never change how an already-running contract's
// profit gets split.

export interface ContractInvestorSnapshot {
  id: number;
  contractId: number;
  phaseId: number;
  investorId: number;
  investmentAmount: number;
  percentOfPool: number;
  createdAt: string;
}

export interface ContractInvestorSnapshotWithInvestor
  extends ContractInvestorSnapshot {
  investorName: string;
}

// ── Withdrawals (Phase 2) ──

export interface Withdrawal {
  id: number;
  investorId: number;
  amount: number;
  reason: string | null;
  withdrawalDate: string;
  createdAt: string;
  updatedAt: string;
  syncVersion: number;
}

export interface WithdrawalWithInvestor extends Withdrawal {
  investorName: string;
  /** This investor's available balance immediately after this specific
   * withdrawal — i.e. their distributed profit total minus every
   * withdrawal up to and including this one, in chronological order. */
  remainingBalance: number;
}