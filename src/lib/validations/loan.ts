import { z } from "zod";

export const loanSchema = z.object({
  lenderName: z.string().trim().min(2, "Lender name is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  loanDate: z.string().min(1, "Loan date is required"),
});

export type LoanFormValues = z.infer<typeof loanSchema>;

export const loanRepaymentSchema = z.object({
  loanId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  repaymentDate: z.string().min(1, "Repayment date is required"),
});

export type LoanRepaymentFormValues = z.infer<typeof loanRepaymentSchema>;