"use client";

import { ForgotPasswordForm, NeonAuthUIProvider, ResetPasswordForm } from "@neondatabase/auth-ui";
import { authClient } from "@/lib/auth-client";

export default function AuthRecoveryForm({ mode }: { mode: "forgot" | "reset" }) {
  return (
    <NeonAuthUIProvider authClient={authClient} basePath="" redirectTo="/sign-in">
      {mode === "forgot" ? (
        <ForgotPasswordForm />
      ) : (
        <ResetPasswordForm passwordValidation={{ minLength: 10, maxLength: 128 }} />
      )}
    </NeonAuthUIProvider>
  );
}
