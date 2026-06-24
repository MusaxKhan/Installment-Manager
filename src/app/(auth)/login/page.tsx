import type { Metadata } from "next";
import { LoginForm } from "@/components/shared/login-form";

export const metadata: Metadata = {
  title: "Sign in — Sitara Traders",
};

export default function LoginPage() {
  return <LoginForm />;
}
