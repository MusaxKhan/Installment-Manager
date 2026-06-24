import { z } from "zod";

export const investorSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  active: z.boolean().default(true),
});

export type InvestorFormValues = z.infer<typeof investorSchema>;
