import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/shared/reset-password-form";

export const metadata: Metadata = {
  title: "Set new password — Sitara Traders",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}