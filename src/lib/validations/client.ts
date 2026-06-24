import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  cnic: z
    .string()
    .trim()
    .regex(/^\d{5}-\d{7}-\d{1}$|^$/, "CNIC must be in format 12345-1234567-1")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[\d+\-\s()]{7,20}$|^$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
