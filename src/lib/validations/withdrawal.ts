import { z } from "zod";

export const withdrawalSchema = z.object({
  investorId: z.coerce.number().int().positive("Select an investor"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  withdrawalDate: z.string().min(1, "Withdrawal date is required"),
});

export type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;
