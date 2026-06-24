import { z } from "zod";

export const guarantorSchema = z
  .object({
    name: z.string().trim().optional().or(z.literal("")),
    phone: z.string().trim().optional().or(z.literal("")),
    address: z.string().trim().optional().or(z.literal("")),
    cnic: z
      .string()
      .trim()
      .regex(/^\d{5}-\d{7}-\d{1}$|^$/, "CNIC must be in format 12345-1234567-1")
      .optional()
      .or(z.literal("")),
  })
  .partial();

export const contractSchema = z.object({
  clientId: z.coerce.number().int().positive("Select a client"),
  productName: z.string().trim().min(2, "Product name is required"),
  productDescription: z.string().trim().max(1000).optional().or(z.literal("")),
  initiatedBy: z.string().trim().min(2, "Initiated by is required"),
  purchasePrice: z.coerce
    .number()
    .positive("Purchase price must be greater than 0"),
  profitPercent: z.coerce
    .number()
    .min(0, "Profit % cannot be negative")
    .max(1000, "That profit % looks too high — please double check"),
  numberOfInstallments: z.coerce
    .number()
    .int()
    .min(1, "At least 1 installment required")
    .max(120, "Maximum 120 installments"),
  startDate: z.string().min(1, "Start date is required"),
  hasGuarantor: z.boolean().default(false),
  guarantor: guarantorSchema.optional(),
});

export type ContractFormValues = z.infer<typeof contractSchema>;
