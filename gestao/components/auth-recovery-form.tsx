"use client";

import { ForgotPasswordForm, NeonAuthUIProvider, ResetPasswordForm } from "@neondatabase/auth-ui";
import { authClient } from "@/lib/auth-client";

export default function AuthRecoveryForm({ mode }: { mode: "forgot" | "reset" }) {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/sign-in">
      {mode === "forgot" ? (
        <ForgotPasswordForm redirectTo="/reset-password" />
      ) : (
        <ResetPasswordForm redirectTo="/sign-in" passwordValidation={{ minLength: 10, maxLength: 128 }} />
      )}
    </NeonAuthUIProvider>
  );
}
