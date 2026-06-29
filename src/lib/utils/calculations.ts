/**
 * Core financial calculations for Sitara Traders.
 *
 * This is the single source of truth for every derived number in the
 * system. Nothing outside this file should re-derive profit, totals,
 * or installment splits — import from here instead.
 *
 * All money values are rounded to 2 decimal places (paisa) at the point
 * of calculation to avoid floating point drift across many installments.
 */

import { addMonths, toDateInputValue } from "./format";

/**
 * A client is blacklisted once any single contract of theirs has been
 * continuously overdue for this many months or more. Centralized here
 * so the threshold is defined exactly once — client-service.ts reads
 * this when computing blacklist status, and any UI copy referencing
 * "3 months" should pull from here too rather than hardcoding it again.
 */
export const BLACKLIST_OVERDUE_MONTHS_THRESHOLD = 3;

/** Round to 2 decimal places, avoiding binary float artifacts like 12.000000001 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface ContractFinancials {
  profitAmount: number;
  totalPrice: number;
  amountPerInstallment: number;
  /** Last installment absorbs the rounding remainder so the sum is exact */
  finalInstallmentAmount: number;
}

/**
 * Profit Amount = Purchase Price × Profit % / 100
 * Total Price   = Purchase Price + Profit Amount
 * Amount Per Installment = Total Price / Number of Installments
 *
 * Because Total Price / N installments rarely divides evenly, the first
 * (N-1) installments get the rounded per-installment amount, and the
 * final installment gets whatever is left — guaranteeing the schedule
 * sums to exactly Total Price.
 */
export function calculateContractFinancials(
  purchasePrice: number,
  profitPercent: number,
  numberOfInstallments: number
): ContractFinancials {
  if (purchasePrice <= 0) {
    throw new Error("Purchase price must be greater than zero.");
  }
  if (numberOfInstallments <= 0) {
    throw new Error("Number of installments must be greater than zero.");
  }
  if (profitPercent < 0) {
    throw new Error("Profit percent cannot be negative.");
  }

  const profitAmount = round2(purchasePrice * (profitPercent / 100));
  const totalPrice = round2(purchasePrice + profitAmount);
  const amountPerInstallment = round2(totalPrice / numberOfInstallments);

  const sumOfFirstNMinus1 = round2(
    amountPerInstallment * (numberOfInstallments - 1)
  );
  const finalInstallmentAmount = round2(totalPrice - sumOfFirstNMinus1);

  return {
    profitAmount,
    totalPrice,
    amountPerInstallment,
    finalInstallmentAmount,
  };
}

export interface GeneratedInstallment {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  installmentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "PENDING";
}

/**
 * Generates the full installment schedule for a new contract.
 * Due dates are spaced one calendar month apart starting from startDate
 * (first installment due exactly one month after the start date).
 */
export function generateInstallmentSchedule(
  startDate: Date,
  numberOfInstallments: number,
  amountPerInstallment: number,
  finalInstallmentAmount: number
): GeneratedInstallment[] {
  const schedule: GeneratedInstallment[] = [];

  for (let i = 1; i <= numberOfInstallments; i++) {
    const dueDate = addMonths(startDate, i);
    const isLast = i === numberOfInstallments;
    const amount = isLast ? finalInstallmentAmount : amountPerInstallment;

    schedule.push({
      installmentNumber: i,
      dueDate: toDateInputValue(dueDate),
      installmentAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
      status: "PENDING",
    });
  }

  return schedule;
}

export function calculateExpectedEndDate(
  startDate: Date,
  numberOfInstallments: number
): string {
  return toDateInputValue(addMonths(startDate, numberOfInstallments));
}

// ─────────────────────────────────────────────────────────────────────────
// Payment allocation
// ─────────────────────────────────────────────────────────────────────────

export interface InstallmentForAllocation {
  id: number;
  installmentNumber: number;
  installmentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface AllocationResult {
  installmentId: number;
  installmentNumber: number;
  amountApplied: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  newStatus: "PARTIAL" | "PAID";
}

export interface PaymentAllocationOutcome {
  allocations: AllocationResult[];
  /** Any amount left over after every installment is fully paid (overpayment) */
  unallocatedAmount: number;
  newContractRemainingBalance: number;
  contractCompleted: boolean;
}

/**
 * Allocates a payment amount across outstanding installments, oldest
 * (lowest installment_number) first. Handles partial, exact, overpayment,
 * and "pay off the whole contract early" cases uniformly.
 *
 * Pure function — callers are responsible for persisting the result.
 */
export function allocatePayment(
  amountPaid: number,
  outstandingInstallments: InstallmentForAllocation[],
  currentContractRemainingBalance: number
): PaymentAllocationOutcome {
  if (amountPaid <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  // Always process oldest-due installments first.
  const sorted = [...outstandingInstallments]
    .filter((inst) => inst.remainingAmount > 0)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  let remainingPayment = round2(amountPaid);
  const allocations: AllocationResult[] = [];

  for (const inst of sorted) {
    if (remainingPayment <= 0) break;

    const amountApplied = round2(
      Math.min(remainingPayment, inst.remainingAmount)
    );
    const newPaidAmount = round2(inst.paidAmount + amountApplied);
    const newRemainingAmount = round2(inst.remainingAmount - amountApplied);

    allocations.push({
      installmentId: inst.id,
      installmentNumber: inst.installmentNumber,
      amountApplied,
      newPaidAmount,
      newRemainingAmount,
      newStatus: newRemainingAmount <= 0 ? "PAID" : "PARTIAL",
    });

    remainingPayment = round2(remainingPayment - amountApplied);
  }

  const newContractRemainingBalance = round2(
    Math.max(0, currentContractRemainingBalance - amountPaid + remainingPayment)
  );

  return {
    allocations,
    unallocatedAmount: remainingPayment,
    newContractRemainingBalance,
    contractCompleted: newContractRemainingBalance <= 0,
  };
}