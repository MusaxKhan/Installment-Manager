import { z } from "zod";

export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "JazzCash",
  "Easypaisa",
  "Custom",
] as const;

export const paymentSchema = z.object({
  contractId: z.coerce.number().int().positive(),
  amountPaid: z.coerce.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentDate: z.string().min(1, "Payment date is required"),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const paymentEditSchema = z.object({
  paymentId: z.coerce.number().int().positive(),
  newAmount: z.coerce.number().positive("Amount must be greater than 0"),
  reason: z.string().trim().min(5, "Please provide a reason for this edit"),
});

export type PaymentEditFormValues = z.infer<typeof paymentEditSchema>;
