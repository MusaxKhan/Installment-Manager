import { z } from "zod";

export const businessPhaseSchema = z
  .object({
    phaseName: z.string().trim().min(2, "Phase name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.endDate ||
      data.endDate.trim() === "" ||
      new Date(data.endDate) >= new Date(data.startDate),
    {
      message: "End date cannot be before the start date",
      path: ["endDate"],
    }
  );

export type BusinessPhaseFormValues = z.infer<typeof businessPhaseSchema>;

export const investorPhaseInvestmentSchema = z.object({
  phaseId: z.coerce.number().int().positive("Select a phase"),
  investorId: z.coerce.number().int().positive("Select an investor"),
  investmentAmount: z.coerce
    .number()
    .positive("Investment amount must be greater than 0"),
});

export type InvestorPhaseInvestmentFormValues = z.infer<
  typeof investorPhaseInvestmentSchema
>;
